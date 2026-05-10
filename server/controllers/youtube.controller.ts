import { Request, Response } from 'express';
import { youtubeService } from '../services/youtube.service.ts';
import { config } from '../config/index.ts';
import path from 'path';
import logger from '../utils/logger.ts';

export class YoutubeController {
  public static async getAuthUrl(req: Request, res: Response) {
    const client = youtubeService.getOAuth2Client();
    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload", 
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];
    
    try {
      const url = client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
        include_granted_scopes: true
      });
      res.json({ url });
    } catch (err: any) {
      res.status(500).json({ error: "Auth URL generation failed" });
    }
  }

  public static async handleCallback(req: Request, res: Response) {
    const { code } = req.query;
    if (!code) return res.status(400).send("No code provided");

    try {
      const client = youtubeService.getOAuth2Client();
      const { tokens } = await client.getToken(code as string);
      
      res.cookie('yt_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.send(`
        <html>
          <body style="background: #000; color: #22c55e; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
            <div style="text-align: center;">
              <h2>YouTube Connected!</h2>
              <p style="color: #fff;">You can close this window now.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1000);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send("Callback failed: " + err.message);
    }
  }

  public static async getStatus(req: Request, res: Response) {
    const tokens = req.cookies.yt_tokens;
    if (!tokens) return res.json({ connected: false });

    try {
      const status = await youtubeService.getChannelStatus(JSON.parse(tokens));
      res.json(status);
    } catch (err) {
      res.json({ connected: false });
    }
  }

  public static async upload(req: Request, res: Response) {
    const { title, description, contentId } = req.body;
    const tokens = req.cookies.yt_tokens;

    if (!tokens) return res.status(401).json({ error: "Not connected" });
    
    const filePath = path.join(config.uploadDir, `${contentId}.mp4`);
    
    try {
      const result = await youtubeService.uploadVideo(JSON.parse(tokens), filePath, { title, description });
      res.json({ success: true, videoId: result.id });
    } catch (err: any) {
      logger.error(`YouTube Upload Failed: ${err.message}`);
      res.status(500).json({ error: "Upload failed", detail: err.message });
    }
  }
}
