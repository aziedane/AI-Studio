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
      // 1. Produce Visuals (Images/Videos) & Audio Scene by Scene
      addLog(`[PIPELINE] Memulai pembangkitan aset scenografis...`, "process");
      
      const producedScenes: any[] = [...item.videoStoryboard];
      
      for (let i = 0; i < producedScenes.length; i++) {
        const scene = producedScenes[i];
        if (!scene) continue;
        
        addLog(`[PIPELINE] Memproses Scene #${i + 1}/${producedScenes.length}...`, "process");
        
        // Visual
        let visualResults;
        try {
          visualResults = await aiService.produceAssets([scene]);
        } catch (visErr: any) {
          addLog(`[PIPELINE] Gagal memproduksi visual scene #${i + 1}: ${visErr.message}`, "error");
          throw visErr;
        }
        const visualScene = visualResults[0] || scene;
        
        // Audio
        let voiceUrl = undefined;
        try {
          if (visualScene.audio) {
            voiceUrl = await ttsService.generateAudio(visualScene.audio, visualScene.voiceTone) || undefined;
          } else {
            addLog(`[PIPELINE] Scene #${i + 1} tidak memiliki teks narasi.`, "info");
          }
        } catch (ttsErr: any) {
          console.warn("TTS Failed for scene", i, ttsErr);
          addLog(`[PIPELINE] TTS Gagal untuk scene #${i + 1}: ${ttsErr.message || "Unknown"}`, "info");
          // Don't throw for TTS, continue without audio if necessary
        }

        producedScenes[i] = {
          ...visualScene,
          voiceUrl: voiceUrl || null
        };
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

      await supabaseService.updateContentItem(contentId, finalUpdates);
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

    // Background process - no blocking modal
    addLog(`[MASTERING] Menjalankan Server-Side Cinema Engine: ${item.title}`, "process");
    setNotification({ msg: "Render dimulai di backend. Anda bisa tetap bekerja.", type: "info" });
    updateAgent('publisher', { status: 'WORKING', lastAction: 'Backend Rendering...' });

    try {
      addLog("[PIPELINE] Mempersiapkan paket storyboard ke server render...", "process");
      
      const response = await fetch('/api/render-backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentId,
          title: item.title,
          storyboard: item.videoStoryboard
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.details || data.error || "Server render failed");
      }

      if (data.success && data.downloadUrl) {
        addLog(`[MASTERING] Server sukses merender video HD MP4.`, "success");
        
        await supabaseService.updateContentItem(contentId, {
          status: 'READY',
          progress: 100,
          downloadUrl: data.downloadUrl
        });
        
        addLog("Video Master siap untuk diunduh.", "success");
        setNotification({ msg: "Video Berhasil Dirender! Silakan unduh.", type: "success" });
        updateAgent('publisher', { status: 'SUCCESS', lastAction: 'HD MP4 Ready' });
        return true;
      }
      throw new Error("Respons server tidak valid.");
    } catch (e: any) {
      console.error("Render error:", e);
      addLog(`Gagal merender video: ${e.message}`, "info");
      updateAgent('publisher', { status: 'ERROR', lastAction: 'Render Error' });
      setNotification({ msg: "Render Gagal. Cek Log.", type: "error" });
      return false;
    } finally {
      setIsRendering(false);
    }
  };

  const downloadVideo = async (url: string, title: string) => {
    try {
      addLog("[PIPELINE] Mengunduh video master...", "process");
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${title.replace(/\s+/g, '_')}_master.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
      addLog("Unduhan dimulai.", "success");
    } catch (err) {
      console.error("Download failed:", err);
      addLog("Gagal mengunduh video.", "info");
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
