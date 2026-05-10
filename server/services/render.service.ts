import { config } from '../config/index.ts';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { exec } from 'child_process';
import logger from '../utils/logger.ts';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from './supabase.service.ts';

export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface RenderJob {
  id: string;
  contentId: string;
  userId: string;
  fullItem: any;
  title: string;
  status: JobStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: number;
}

class RenderService {
  private jobs: Map<string, RenderJob> = new Map();
  private maxConcurrent = 2;
  private currentActive = 0;
  private queue: string[] = [];

  constructor() {
    this.ensureUploadDir();
  }

  private ensureUploadDir() {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  }

  public createJob(contentId: string, title: string, storyboard: any[], userId: string, fullItem: any): string {
    const jobId = uuidv4();
    const job: RenderJob = {
      id: jobId,
      contentId,
      userId,
      fullItem: { ...fullItem, videoStoryboard: storyboard }, // Pastikan storyboard ada di fullItem
      title,
      status: 'PENDING',
      progress: 0,
      createdAt: Date.now(),
    };
    
    this.jobs.set(jobId, job);
    this.queue.push(jobId);
    
    // Trigger processing
    this.processQueue();
    
    return jobId;
  }

  public getJob(id: string): RenderJob | undefined {
    return this.jobs.get(id);
  }

  private async processQueue() {
    if (this.currentActive >= this.maxConcurrent || this.queue.length === 0) return;

    const jobId = this.queue.shift()!;
    const job = this.jobs.get(jobId)!;
    
    this.currentActive++;
    job.status = 'PROCESSING';
    
    try {
      const storyboard = job.fullItem.videoStoryboard || [];
      // Progress tracking is now only in-memory on server, not in Supabase yet
      await this.runRender(job, storyboard);
      job.status = 'COMPLETED';
      job.progress = 100;
      
      // FINALLY SAVE TO SUPABASE when COMPLETED
      logger.info(`Persisting completed job ${jobId} to Supabase...`);
      await supabaseAdmin.saveContentItem({
        ...job.fullItem,
        status: 'READY',
        progress: 100,
        downloadUrl: job.resultUrl,
        updatedAt: new Date().toISOString()
      }, job.userId);
      
      logger.info(`Render Job ${jobId} Completed Successfully`);
    } catch (err: any) {
      job.status = 'FAILED';
      job.error = err.message;
      // Do NOT save FAILED items to DB as per user request
      logger.error(`Render Job ${jobId} Failed: ${err.message}`);
    } finally {
      this.currentActive--;
      this.processQueue(); // Continue with next in queue
    }
  }

  private async generateSilence(path: string, duration: number) {
    return new Promise((resolve, reject) => {
      exec(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${duration} -q:a 9 -acodec libmp3lame "${path}"`, (err) => {
        if (err) {
          logger.error(`[RENDERER] Gagal membuat audio hening: ${err.message}`);
          reject(err);
        } else resolve(true);
      });
    });
  }

  private async runRender(job: RenderJob, storyboard: any[]) {
    const workDir = path.join(config.uploadDir, `render_${job.id}_${Date.now()}`);
    fs.mkdirSync(workDir, { recursive: true });
    logger.info(`[RENDERER] Job ${job.id}: Menjalankan render di ${workDir}`);
    job.progress = 1; // Setel progress awal agar tidak terlihat mandek di 0%

    try {
      // Step 1: Download Assets
      const preparedScenes: any[] = [];
      const downloadBatchSize = 4;
      
      for (let i = 0; i < storyboard.length; i += downloadBatchSize) {
        const batch = storyboard.slice(i, i + downloadBatchSize);
        logger.info(`[RENDERER] Job ${job.id}: Mengunduh batch ${Math.floor(i/downloadBatchSize) + 1}`);
        
        await Promise.all(batch.map(async (scene: any, batchIdx: number) => {
          const idx = i + batchIdx;
          const sceneId = `scene_${idx.toString().padStart(3, '0')}`;
          const imgPath = path.join(workDir, `${sceneId}_img.jpg`);
          const audioPath = path.join(workDir, `${sceneId}_audio.mp3`);
          const sceneOutputPath = path.join(workDir, `${sceneId}_out.mp4`);

          const imageUrl = scene.imageUrl || `https://placehold.co/1280x720/000000/FFFFFF?text=SCENE+${idx+1}`;
          
          try {
            await this.downloadWithRetry(imageUrl, imgPath);
          } catch (e) {
            logger.warn(`[RENDERER] Job ${job.id}: Gagal unduh gambar scene ${idx}, pakai placeholder`);
            const placeholderUrl = `https://placehold.co/1280x720/000000/FFFFFF?text=IMAGE+FAILED+${idx+1}`;
            await this.downloadWithRetry(placeholderUrl, imgPath);
          }

          if (scene.voiceUrl) {
            try {
              await this.downloadWithRetry(scene.voiceUrl, audioPath);
            } catch (e) {
              logger.warn(`[RENDERER] Job ${job.id}: Gagal unduh audio scene ${idx}, buat suara hening`);
              await this.generateSilence(audioPath, scene.duration || 5);
            }
          } else {
            await this.generateSilence(audioPath, scene.duration || 5);
          }
          
          preparedScenes[idx] = { imgPath, audioPath, sceneOutputPath, scene, i: idx };
        }));
        
        job.progress = Math.min(15, Math.round(((i + downloadBatchSize) / storyboard.length) * 15)); 
      }

      // Step 2: Render individual scene MP4s
      logger.info(`[RENDERER] Job ${job.id}: Mulai render scene individu (${preparedScenes.length} total)`);
      const sceneFiles: string[] = [];
      const renderBatchSize = 2; 
      
      for (let i = 0; i < preparedScenes.length; i += renderBatchSize) {
        const batch = preparedScenes.slice(i, i + renderBatchSize);
        logger.info(`[RENDERER] Job ${job.id}: Rendering scenes ${i} sampai ${Math.min(i + renderBatchSize, preparedScenes.length)}`);
        
        await Promise.all(batch.map(async (s) => {
          const { imgPath, audioPath, sceneOutputPath, scene, i: idx } = s;
          
          // FFmpeg drawtext complex escaping
          const subtitleText = this.wrapText(scene.audio || "")
            .replace(/\\/g, '\\\\\\\\')
            .replace(/'/g, "'\\\\\\''")
            .replace(/:/g, '\\\\:')
            .replace(/,/g, '\\\\,');

          return new Promise((resolve, reject) => {
            ffmpeg()
              .input(imgPath)
              .loop(scene.duration || 5)
              .input(audioPath)
              .videoFilters([
                { filter: 'scale', options: '1280:720:force_original_aspect_ratio=decrease' },
                { filter: 'pad', options: '1280:720:(ow-iw)/2:(oh-ih)/2' },
                { filter: 'format', options: 'yuv420p' },
                {
                  filter: 'drawtext',
                  options: {
                    text: subtitleText,
                    fontcolor: 'white',
                    fontsize: 32,
                    box: 1,
                    boxcolor: 'black@0.7',
                    boxborderw: 20,
                    x: '(w-text_w)/2',
                    y: 'h-120',
                    fix_bounds: 1
                  }
                }
              ])
              .outputOptions([
                '-c:v libx264',
                '-preset ultrafast',
                '-tune stillimage',
                '-pix_fmt yuv420p',
                '-shortest',
                '-r 30',
                '-c:a aac',
                '-b:a 128k'
              ])
              .on('end', () => {
                logger.info(`[RENDERER] Job ${job.id}: Scene ${idx} selesai`);
                resolve(true);
              })
              .on('error', (err) => {
                logger.error(`[RENDERER] Job ${job.id}: Scene ${idx} gagal: ${err.message}`);
                reject(err);
              })
              .save(sceneOutputPath);
          });
        }));
        
        // Populate sceneFiles after batch completes successfully
        for (const s of batch) {
          sceneFiles[s.i] = s.sceneOutputPath;
        }

        job.progress = 15 + Math.round(((i + renderBatchSize) / preparedScenes.length) * 75); // 15-90%
      }

      // Step 3: Concat
      logger.info(`[RENDERER] Job ${job.id}: Menggabungkan ${sceneFiles.length} scenes`);
      const concatListPath = path.join(workDir, 'list.txt');
      const listContent = sceneFiles.map(f => `file '${path.basename(f!)}'`).join('\n');
      fs.writeFileSync(concatListPath, listContent);

      const finalFileName = `${job.contentId}.mp4`;
      const finalOutputPath = path.join(config.uploadDir, finalFileName);
      
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy'])
          .cwd(workDir) // PENTING: Set working directory agar ffmpeg menemukan file relatif di list.txt
          .on('start', (cmd) => logger.info(`[RENDERER] Job ${job.id}: Menjalankan perintah concat...`))
          .on('end', () => resolve(true))
          .on('error', (err) => {
            logger.error(`[RENDERER] Job ${job.id}: Gagal menggabungkan video: ${err.message}`);
            reject(err);
          })
          .save(finalOutputPath);
      });

      job.resultUrl = `/api/download/${finalFileName}`;
      logger.info(`[RENDERER] Job ${job.id}: Video final siap di ${finalOutputPath}`);
      
      // Cleanup
      setTimeout(() => {
        try { 
          if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true }); 
          logger.info(`[RENDERER] Job ${job.id}: Pembersihan folder kerja selesai`);
        } catch(e) {}
      }, 300000); 

    } catch (err: any) {
      logger.error(`[RENDERER] Job ${job.id}: Kegagalan kritikal di runRender: ${err.message}`);
      if (fs.existsSync(workDir)) {
        try { fs.rmSync(workDir, { recursive: true, force: true }); } catch(e) {}
      }
      throw err;
    }
  }

  private wrapText(text: string, maxChars = 50) {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
      if ((currentLine + word).length > maxChars) {
        lines.push(currentLine.trim());
        currentLine = word + ' ';
      } else {
        currentLine += word + ' ';
      }
    });
    lines.push(currentLine.trim());
    return lines.join('\n');
  }

  private async downloadWithRetry(url: string, dest: string, maxRetries = 4) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(dest, Buffer.from(res.data));
        return true;
      } catch (err: any) {
        if (err.response?.status === 429 && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 2000;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  }
}

export const renderService = new RenderService();
