import { ContentPiece, StoryboardScene } from '../types';

export interface RenderOptions {
  onProgress: (progress: number) => void;
  onLog: (msg: string, type?: string) => void;
  onSceneChange: (index: number) => void;
  userId?: string;
  contentId: string;
}

export class VideoEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private masterGain: GainNode | null = null;
  private offCanvas: HTMLCanvasElement;
  private octx: CanvasRenderingContext2D;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private assetCache: Record<string, HTMLImageElement | HTMLVideoElement> = {};
  private audioCtx: AudioContext | null = null;
  private dest: MediaStreamAudioDestinationNode | null = null;
  private bgMusic: HTMLAudioElement | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Could not get canvas context');
    this.ctx = ctx;

    this.offCanvas = document.createElement('canvas');
    this.offCanvas.width = canvas.width;
    this.offCanvas.height = canvas.height;
    const octx = this.offCanvas.getContext('2d');
    if (!octx) throw new Error('Could not get offscreen canvas context');
    this.octx = octx;
  }

  private async preloadAssets(scenes: StoryboardScene[], onLog: (msg: string, type?: string) => void) {
    onLog("[ENGINE] Memuat aset ke memori...");
    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx];
      
      // Image
      if (scene.imageUrl) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const proxyUrl = scene.imageUrl.startsWith('http') 
          ? `/api/proxy/image?url=${encodeURIComponent(scene.imageUrl)}` 
          : scene.imageUrl;
        
        img.src = proxyUrl;
        const loaded = await new Promise(r => { 
          img.onload = () => r(img.width > 0); 
          img.onerror = () => r(false); 
          setTimeout(() => r(false), 15000); 
        });
        if (loaded) {
          this.assetCache[`img_${idx}`] = img;
        } else {
          onLog(`[ENGINE] Gagal memuat gambar scene #${idx + 1}`, "info");
        }
      }

      // Video
      if (scene.videoUrl) {
        const vid = document.createElement('video');
        vid.crossOrigin = "anonymous";
        const proxyUrl = scene.videoUrl.startsWith('http')
          ? `/api/proxy/video?url=${encodeURIComponent(scene.videoUrl)}`
          : scene.videoUrl;
          
        vid.src = proxyUrl;
        vid.muted = true;
        vid.preload = "auto";
        vid.playsInline = true; 
        vid.load();
        const loaded = await new Promise(r => { 
          vid.oncanplay = () => {
            if (vid.videoWidth > 0) r(true);
            else setTimeout(() => r(true), 1500); 
          }; 
          vid.onerror = (e) => {
            console.warn("[ENGINE] Video preload error", e);
            r(false);
          }; 
          setTimeout(r, 15000); 
        });
        if (loaded) {
          this.assetCache[`vid_${idx}`] = vid;
        } else {
          onLog(`[ENGINE] Gagal memuat video scene #${idx + 1}, fallback ke gambar.`, "info");
        }
      }
    }
    onLog("[ENGINE] Pre-load selesai.");
  }

  private async setupAudio(onLog: (msg: string, type?: string) => void) {
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create master gain for capture
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1.0;
    
    this.dest = this.audioCtx.createMediaStreamDestination();
    this.masterGain.connect(this.dest);
    
    // Monitoring out (optional, enable to hear during render)
    this.masterGain.connect(this.audioCtx.destination);

    await this.audioCtx.resume();
    onLog(`[ENGINE] AudioContext state: ${this.audioCtx.state}`);

    // Constant silent signal to keep the audio track active in the stream
    const silent = this.audioCtx.createOscillator();
    const silentGain = this.audioCtx.createGain();
    silentGain.gain.value = 0.001; 
    silent.connect(silentGain);
    silentGain.connect(this.masterGain);
    silent.start();

    // Background Music
    const bgMusicUrl = "https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a7395a.mp3";
    const proxiedBgMusicUrl = `/api/proxy/audio?url=${encodeURIComponent(bgMusicUrl)}`;
    this.bgMusic = new Audio(proxiedBgMusicUrl);
    this.bgMusic.crossOrigin = "anonymous";
    this.bgMusic.loop = true;
    this.bgMusic.volume = 0.12;
    
    const bgSource = this.audioCtx.createMediaElementSource(this.bgMusic);
    bgSource.connect(this.masterGain);
    
    try { 
      await this.bgMusic.play(); 
      onLog("[ENGINE] Musik latar aktif.");
    } catch (err) { 
      console.warn("BG Music restricted", err); 
      onLog("[ENGINE] Musik latar diblokir browser atau gagal dimuat.", "info");
    }
  }

  private drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement, x: number, y: number, w: number, h: number) {
    try {
      const imgWidth = img instanceof HTMLVideoElement ? img.videoWidth : img.width;
      const imgHeight = img instanceof HTMLVideoElement ? img.videoHeight : img.height;
      if (!imgWidth || !imgHeight) return;

      const offsetX = 0.5;
      const offsetY = 0.5;

      let r = Math.max(w / imgWidth, h / imgHeight);
      let nw = imgWidth * r;
      let nh = imgHeight * r;
      let cx, cy, cw, ch;

      cw = imgWidth / (nw / w);
      ch = imgHeight / (nh / h);

      cx = (imgWidth - cw) * offsetX;
      cy = (imgHeight - ch) * offsetY;

      ctx.drawImage(img, Math.max(0, cx), Math.max(0, cy), Math.min(imgWidth, cw), Math.min(imgHeight, ch), x, y, w, h);
    } catch (e) {
      console.warn("Draw error:", e);
    }
  }

  async render(item: ContentPiece, options: RenderOptions) {
    const { onProgress, onLog, onSceneChange, contentId } = options;
    onLog("[ENGINE] Memulai siklus render...");
    
    try {
      this.assetCache = {};
      await this.preloadAssets(item.videoStoryboard || [], onLog);
      await this.setupAudio(onLog);

      if (!this.canvas) throw new Error("Canvas tidak ditemukan");
      
      const stream = this.canvas.captureStream(30); // 30fps is more stable
      const audioTracks = this.dest?.stream.getAudioTracks() || [];
      onLog(`[ENGINE] Capture started. Tracks: V: ${stream.getVideoTracks().length}, A: ${audioTracks.length}`);
      
      if (audioTracks.length === 0) {
        onLog("[ENGINE] WARNING: No audio tracks found in capture stream!", "info");
      }

      const combined = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioTracks
      ]);

      const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => 
        MediaRecorder.isTypeSupported(type)
      ) || 'video/webm';

      onLog(`[ENGINE] MediaRecorder mime: ${mimeType}`);
      this.recorder = new MediaRecorder(combined, { 
        mimeType,
        videoBitsPerSecond: 5000000 
      });
      
      this.chunks = [];
      this.recorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      const exportPromise = new Promise<Blob>((resolve, reject) => {
        if (!this.recorder) return reject(new Error("Recorder failed to initialize"));
        this.recorder.onstop = () => {
          const blob = new Blob(this.chunks, { type: 'video/webm' });
          resolve(blob);
        };
        this.recorder.onerror = (e) => reject(e);
      });

      this.recorder.start(1000); // Pulse every second to ensure data flow
      onLog("[ENGINE] Recording started.");

      const storyboard = item.videoStoryboard || [];
      if (storyboard.length === 0) {
        throw new Error("Storyboard is empty!");
      }

      for (let i = 0; i < storyboard.length; i++) {
          const scene = storyboard[i];
          onProgress(Math.round(((i + 1) / storyboard.length) * 100));
          onSceneChange(i);
          onLog(`[ENGINE] Rendering Scene #${i + 1}/${storyboard.length}...`);

          const img = this.assetCache[`img_${i}`] as HTMLImageElement;
          const video = this.assetCache[`vid_${i}`] as HTMLVideoElement;
          
          if (!img && !video) {
            onLog(`[ENGINE] WARNING: No visual asset for scene #${i + 1}`, "info");
          }

          if (this.audioCtx && this.audioCtx.state === 'suspended') {
            await this.audioCtx.resume();
          }

          let sceneAudio = new Audio();
          let sceneAudioAvailable = false;

          if (scene.voiceUrl && this.audioCtx && this.masterGain) {
            onLog(`[ENGINE] Menyiapkan audio scene #${i + 1}...`);
            // Add a small delay to prevent rapid-fire requests
            await new Promise(r => setTimeout(r, 100));
            sceneAudio.src = scene.voiceUrl;
            sceneAudio.crossOrigin = "anonymous";
            
            try {
              const sceneAudioSource = this.audioCtx.createMediaElementSource(sceneAudio);
              sceneAudioSource.connect(this.masterGain);
              
              sceneAudioAvailable = await new Promise(res => {
                const timeout = setTimeout(() => {
                  if (sceneAudio.readyState >= 2) {
                    res(true);
                  } else {
                    onLog(`[ENGINE] Timeout memuat audio scene #${i + 1}`, "info");
                    res(false);
                  }
                }, 12000);

                const checkReady = () => {
                  if (sceneAudio.readyState >= 2 && sceneAudio.duration > 0) {
                    clearTimeout(timeout);
                    res(true);
                    return true;
                  }
                  return false;
                };

                if (!checkReady()) {
                  sceneAudio.oncanplay = checkReady;
                  sceneAudio.oncanplaythrough = checkReady;
                  sceneAudio.onerror = (err) => {
                    console.warn(`[ENGINE] Audio error scene #${i+1}`, err);
                    clearTimeout(timeout);
                    res(false);
                  };
                }
              });
            } catch (audioErr) {
              console.error("[ENGINE] Audio integration error", audioErr);
            }
          }

          if (sceneAudioAvailable) {
            try {
              await sceneAudio.play();
            } catch (playErr) {
              console.warn("[ENGINE] Voice play failed", playErr);
            }
          }

          if (video) {
            try {
              video.currentTime = 0;
              await video.play();
            } catch (vPlayErr) {
              console.warn("[ENGINE] Video play failed", vPlayErr);
            }
          }
          
          await new Promise<void>((resolveLoop) => {
            let startTime: number | null = null;
            // Ensure duration is never less than 4s for stability
            let effectiveDuration = Math.max(scene.duration || 6, 4) * 1000;
            
            if (sceneAudioAvailable && !isNaN(sceneAudio.duration) && sceneAudio.duration > 0) {
               effectiveDuration = (sceneAudio.duration + 0.8) * 1000;
            }
            
            let active = true;
            const safetyTimeout = setTimeout(() => {
              if (active) {
                console.warn(`[ENGINE] Safety jump for scene #${i + 1}`);
                active = false;
                if (video) video.pause();
                resolveLoop();
              }
            }, effectiveDuration + 5000);

            const renderFrame = (timestamp: number) => {
              if (!active) return;
              if (startTime === null) startTime = timestamp;
              
              const elapsed = timestamp - startTime;
              const progress = Math.min(elapsed / effectiveDuration, 1);

              if (elapsed >= effectiveDuration) {
                active = false;
                clearTimeout(safetyTimeout);
                if (video) video.pause();
                resolveLoop();
                return;
              }

              this.octx.fillStyle = '#050505';
              this.octx.fillRect(0, 0, this.offCanvas.width, this.offCanvas.height);
              
              const scale = 1 + (progress * 0.1);
              const dw = this.offCanvas.width * scale;
              const dh = this.offCanvas.height * scale;
              const dx = (this.offCanvas.width - dw) / 2;
              const dy = (this.offCanvas.height - dh) / 2;

              if (video && video.readyState >= 2) {
                 this.drawImageCover(this.octx, video, dx, dy, dw, dh);
              } else if (img) {
                 this.drawImageCover(this.octx, img, dx, dy, dw, dh);
              } else {
                // Background color per scene for fallback visibility
                const colors = ['#1a1a1a', '#0d0d0d', '#141414', '#0f0f0f'];
                this.octx.fillStyle = colors[i % colors.length];
                this.octx.fillRect(0, 0, this.offCanvas.width, this.offCanvas.height);
              }

              this.drawSubtitles(scene.audio);

              this.octx.fillStyle = 'rgba(255,255,255,0.2)';
              this.octx.font = '12px monospace';
              this.octx.fillText('AI STUDIO PRO / NEURAL CINEMA', 100, 30);

              this.ctx.drawImage(this.offCanvas, 0, 0);
              requestAnimationFrame(renderFrame);
            };
            requestAnimationFrame(renderFrame);
          });

          if (sceneAudioAvailable) {
            sceneAudio.pause();
            sceneAudio.src = "";
          }
      }

      onLog("[ENGINE] Rendering finished. Finalizing file...");
      this.recorder.stop();
      const blob = await exportPromise;
      onLog(`[ENGINE] Recorded Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
      
      if (blob.size < 5000) { // More than 5KB should be enough to not be "empty"
        throw new Error("Recorded video is too small. Stream capture likely failed.");
      }

      this.cleanup();
      return blob;
    } catch (err: any) {
      onLog(`[ENGINE] ERROR: ${err.message}`, "info");
      if (this.recorder && this.recorder.state !== 'inactive') {
        this.recorder.stop();
      }
      this.cleanup();
      throw err;
    }
  }

  private drawSubtitles(text: string) {
    const rawText = text.replace(/^(Scene|Narator|Visual|Prompt)\s*[:\s-]+/i, "").trim();
    const cleanText = rawText.replace(/\[.*?\]/g, "").toUpperCase();

    this.octx.font = '700 48px "Inter", sans-serif';
    this.octx.textAlign = 'center';
    this.octx.textBaseline = 'middle';
    
    // Text Wrapping
    const maxWidth = this.offCanvas.width * 0.8;
    const words = cleanText.split(' ');
    const lines = [];
    let currentLine = '';

    for (let word of words) {
      if (this.octx.measureText(currentLine + word).width > maxWidth) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    }
    lines.push(currentLine.trim());

    const lineHeight = 64;
    const startY = this.offCanvas.height - 160 - (lines.length * lineHeight / 2);

    this.octx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    const maxLineWidth = Math.max(...lines.map(l => this.octx.measureText(l).width));
    this.octx.beginPath();
    this.octx.roundRect(
      (this.offCanvas.width - maxLineWidth) / 2 - 50, 
      startY - lineHeight / 2 - 25, 
      maxLineWidth + 100, 
      lines.length * lineHeight + 50, 
      12
    );
    this.octx.fill();

    this.octx.fillStyle = 'white';
    lines.forEach((line, idx) => {
      this.octx.fillText(line, this.offCanvas.width / 2, startY + (idx * lineHeight));
    });
  }

  private cleanup() {
    if (this.bgMusic) {
      this.bgMusic.pause();
      this.bgMusic = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
