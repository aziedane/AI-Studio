import { Request, Response } from 'express';
import { ttsService } from '../services/tts.service.ts';

export class TTSController {
  public static async synthesize(req: Request, res: Response) {
    const { text, voice, emotion } = req.body;
    if (!text) return res.status(400).json({ error: "Text required" });

    try {
      const result = await ttsService.generateSpeech(text, voice, emotion);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "TTS failed" });
    }
  }
}
