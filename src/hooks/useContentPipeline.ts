import { useAppStore } from '../store/useAppStore';
import { aiService } from '../services/ai.service';
import { supabaseService } from '../services/supabase.service';
import { VideoEngine } from '../engines/videoEngine';
import { ContentPiece } from '../types';
import { ttsService } from '../services/tts.service';
import React from 'react';

export const useContentPipeline = (canvasRef: React.RefObject<HTMLCanvasElement>) => {
  const { 
    user, 
    addLog, 
    updateAgent, 
    setContentItems, 
    contentItems, 
    setIsRendering, 
    setRenderProgress, 
    setCurrentScene,
    setNotification,
    ytConnected
  } = useAppStore();

  const produceMedia = async (contentId: string, initialItem?: ContentPiece) => {
    if (!user) return;
    const item = initialItem || contentItems.find(c => c.id === contentId);
    if (!item) {
      addLog(`[PIPELINE] Item ${contentId} tidak ditemukan di store.`, "info");
      return;
    }
    
    if (!item.videoStoryboard || item.videoStoryboard.length === 0) {
      addLog(`[PIPELINE] Storyboard kosong untuk: ${item.title}`, "info");
      return;
    }

    updateAgent('producer', { status: 'WORKING', lastAction: 'Generating Audio & Visuals...' });
    addLog(`[PIPELINE] Memulai produksi aset untuk: ${item.title}`, "process");

    try {
      addLog(`[PIPELINE] Memulai pembangkitan aset scenografis secara paralel...`, "process");
      
      const producedScenes: any[] = [...item.videoStoryboard];
      
      // Parallelize all scenes with concurrency limit (e.g. 4)
      const batchSize = 4;
      for (let i = 0; i < producedScenes.length; i += batchSize) {
        const batch = producedScenes.slice(i, i + batchSize);
        addLog(`[PIPELINE] Memproses Batch #${Math.floor(i/batchSize) + 1}...`, "process");
        
        await Promise.allSettled(batch.map(async (scene, batchIdx) => {
          const idx = i + batchIdx;
          if (!scene) return;

          // 1. Visual
          let visualResults;
          try {
            visualResults = await aiService.produceAssets([scene]);
          } catch (visErr) {
            console.warn(`Visual failed for scene ${idx}`, visErr);
          }
          const visualScene = (visualResults && visualResults[0]) || scene;

          // 2. Audio
          let voiceUrl = undefined;
          try {
            if (visualScene.audio) {
              voiceUrl = await ttsService.generateAudio(visualScene.audio, visualScene.voiceTone) || undefined;
            }
          } catch (ttsErr) {
            console.warn(`TTS failed for scene ${idx}`, ttsErr);
          }

          producedScenes[idx] = {
            ...visualScene,
            voiceUrl: voiceUrl || null
          };
        }));
      }

      // Batch update after all scenes are done to save quota
      addLog(`[PIPELINE] Menciptakan thumbnail...`, "process");
      updateAgent('thumbnail', { status: 'WORKING', lastAction: 'Generating Thumbnail...' });
      
      let thumbnailUrl = item.thumbnailUrl;
      try {
        thumbnailUrl = await aiService.createThumbnail(item.title, item.script);
        updateAgent('thumbnail', { status: 'SUCCESS', lastAction: 'Thumbnail Ready' });
      } catch (thumbErr) {
        console.warn("Thumbnail failed", thumbErr);
        updateAgent('thumbnail', { status: 'ERROR', lastAction: 'Thumbnail Failed' });
      }
      
      const finalUpdates = {
        videoStoryboard: producedScenes,
        thumbnailUrl,
        progress: 80,
        status: 'PRODUCTION' as const,
        updatedAt: new Date().toISOString()
      };

      const currentItems = useAppStore.getState().contentItems;
      useAppStore.getState().setContentItems(
        currentItems.map(i => i.id === contentId ? { ...i, ...finalUpdates } : i)
      );
      
      addLog(`[PIPELINE] Seluruh aset visual & audio siap. Status: PRODUCTION`, "success");
      updateAgent('producer', { status: 'SUCCESS', lastAction: 'Production Ready' });
      
      return { ...item, ...finalUpdates };
    } catch (e: any) {
      const errorMessage = e.message || "Unknown Error";
      addLog(`Gagal memproduksi aset visual: ${errorMessage}`, "error");
      console.error("[PIPELINE ERROR]", e);
      updateAgent('producer', { status: 'ERROR', lastAction: `Gagal: ${errorMessage}` });
      return null;
    }
  };

  const renderVideo = async (contentId: string, itemOverride?: ContentPiece) => {
    if (!user) return;
    const item = itemOverride || contentItems.find(c => c.id === contentId);
    if (!item) return;

    addLog(`[MASTERING] Memulai render background: ${item.title}`, "process");
    // Removed toast notification to reduce noise, keep in system log only
    // setNotification({ msg: "Render dimulai di server.", type: "info" });

    try {
      const response = await fetch('/api/render-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          userId: user.id, // PASS USER ID
          title: item.title,
          storyboard: item.videoStoryboard,
          fullItem: item // PASS FULL ITEM DATA
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gagal memulai render");

      addLog(`[PIPELINE] Job render ${data.jobId} berhasil didaftarkan.`, "success");
      
      // Start polling for status
      const jobId = data.jobId;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/render/status/${jobId}`);
          if (!statusRes.ok) throw new Error("Gagal mengambil status");
          const job = await statusRes.json();
          
          if (job.status === 'COMPLETED') {
            clearInterval(pollInterval);
            addLog(`[PIPELINE] Render selesai untuk: ${item.title}`, "success");
            // No need to manually update contentItems here because Supabase sync 
            // will pick up the new record once the server saves it.
          } else if (job.status === 'FAILED') {
            clearInterval(pollInterval);
            addLog(`[PIPELINE] Render gagal: ${job.error || "Unknown error"}`, "error");
            const current = useAppStore.getState().contentItems;
            useAppStore.getState().setContentItems(
              current.map(i => i.id === contentId ? { ...i, status: 'FAILED' } : i)
            );
          } else {
            // Update local progress with actual backend progress
            const current = useAppStore.getState().contentItems;
            useAppStore.getState().setContentItems(
              current.map(i => i.id === contentId ? { ...i, progress: job.progress } : i)
            );
            console.log(`[POLL] Job ${jobId} progress: ${job.progress}%`);
          }
        } catch (pollErr) {
          console.error("Polling error:", pollErr);
        }
      }, 3000); // Poll every 3 seconds

      return true;
    } catch (e: any) {
      addLog(`Gagal: ${e.message}`, "error");
      const currentItems = useAppStore.getState().contentItems;
      useAppStore.getState().setContentItems(
        currentItems.map(i => i.id === contentId ? { ...i, status: 'FAILED' } : i)
      );
      return false;
    }
  };

  const downloadVideo = async (url: string, title: string) => {
    try {
      addLog("[PIPELINE] Mengunduh file dari server...", "process");
      const response = await fetch(url);
      const blob = await response.blob();
      
      // Determine extension from url or content-type
      let ext = 'mp4';
      const lowercaseUrl = url.toLowerCase();
      if (lowercaseUrl.includes('.jpg') || lowercaseUrl.includes('.jpeg') || lowercaseUrl.includes('format=jpg') || lowercaseUrl.includes('format=jpeg')) ext = 'jpg';
      else if (lowercaseUrl.includes('.png') || lowercaseUrl.includes('format=png')) ext = 'png';
      else if (lowercaseUrl.includes('.webp') || lowercaseUrl.includes('format=webp')) ext = 'webp';
      else if (lowercaseUrl.includes('.mp4')) ext = 'mp4';
      else if (response.headers.get('Content-Type')?.includes('image')) {
        const ct = response.headers.get('Content-Type');
        if (ct?.includes('png')) ext = 'png';
        else if (ct?.includes('webp')) ext = 'webp';
        else ext = 'jpg';
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title.replace(/\s+/g, '_')}.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      addLog("Unduhan dimulai.", "success");
    } catch (err) {
      console.error("Download failed:", err);
      addLog("Gagal mengunduh file.", "info");
      window.open(url, '_blank'); // Fallback
    }
  };

  const finalizePipeline = async (contentId: string) => {
    if (!user) return;
    if (!ytConnected) {
      addLog("YouTube belum terhubung. Silakan hubungkan akun YouTube Anda.", "info");
      setNotification({ msg: "Hubungkan YouTube Dulu", type: "info" });
      return;
    }
    const item = contentItems.find(c => c.id === contentId);
    if (!item) return;

    updateAgent('publisher', { status: 'WORKING', lastAction: 'Uploading to YouTube...' });
    addLog(`[PIPELINE] Memulai pengunggahan ke YouTube: ${item.title}`, "process");

    try {
      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: item.title, 
          description: item.script,
          contentId: item.id
        })
      });

      const data = await response.json();
      if (data.success) {
        await supabaseService.updateContentItem(contentId, {
          status: 'PUBLISHED',
          progress: 100,
          publishedUrl: `https://www.youtube.com/watch?v=${data.videoId}`,
          publishedAt: new Date().toISOString()
        });
        addLog("Konten berhasil dipublikasikan ke YouTube.", "success");
        setNotification({ msg: "Video Berhasil Diunggah!", type: "success" });
        updateAgent('publisher', { status: 'SUCCESS', lastAction: 'Konten Live' });
      } else {
        throw new Error(data.error || "Gagal mengunggah");
      }
    } catch (e: any) {
      addLog(`Gagal mengunggah ke YouTube: ${e.message}`, "info");
      updateAgent('publisher', { status: 'ERROR', lastAction: 'Upload Gagal' });
    }
  };

  return { produceMedia, renderVideo, finalizePipeline, downloadVideo };
};
