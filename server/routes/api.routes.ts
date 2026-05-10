import { Router } from 'express';
import { RenderController } from '../controllers/render.controller.ts';
import { StockController } from '../controllers/stock.controller.ts';
import { TTSController } from '../controllers/tts.controller.ts';
import { YoutubeController } from '../controllers/youtube.controller.ts';
import { ContentController } from '../controllers/content.controller.ts';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.ts';
import axios from 'axios';

const router = Router();

// Render
router.post('/render-backend', RenderController.startRender);
router.get('/render/status/:id', RenderController.getStatus);

// Stock
router.get('/stock/video', StockController.search);

// TTS
router.post('/tts', TTSController.synthesize);

// YouTube
router.get('/auth/youtube', YoutubeController.getAuthUrl);
router.get('/auth/status', YoutubeController.getStatus);
router.post('/youtube/upload', YoutubeController.upload);

// Content
router.delete('/content/:id', ContentController.deleteItem);

// Download
router.get('/download/:filename', (req, res) => {
  const filePath = path.join(config.uploadDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath, req.params.filename);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// Proxy
router.get(['/proxy/image', '/proxy/video', '/proxy/audio'], async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("URL required");
  
  try {
    const response = await axios({
      method: 'get',
      url: url as string,
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });
    
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', (contentType ? String(contentType) : 'application/octet-stream'));
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

export default router;
