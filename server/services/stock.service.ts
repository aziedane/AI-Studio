import axios from 'axios';
import { config } from '../config/index.ts';
import logger from '../utils/logger.ts';

class StockService {
  public async searchVideo(query: string) {
    const apiKey = config.pexelsApiKey;
    if (!apiKey) {
      logger.warn('[STOCK] PEXELS_API_KEY missing');
      return { error: "PEXELS_API_KEY missing", fallback: true };
    }

    try {
      const response = await this.fetchWithRetry(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`,
        { Authorization: apiKey }
      );
      
      const videos = response?.data.videos;
      if (videos && videos.length > 0) {
        const video = videos[Math.floor(Math.random() * Math.min(videos.length, 3))];
        const file = video.video_files.find((f: any) => f.quality === 'hd' || f.quality === 'sd') || video.video_files[0];
        return { url: file.link };
      }
      return { error: "No video found" };
    } catch (err: any) {
      logger.error(`[STOCK] Pexels API failed: ${err.message}`);
      throw err;
    }
  }

  private async fetchWithRetry(url: string, headers: any, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await axios.get(url, { headers, timeout: 30000 });
      } catch (err: any) {
        if (err.response?.status === 429 && attempt < maxRetries) {
          const delay = 2000 * (attempt + 1);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  }
}

export const stockService = new StockService();
