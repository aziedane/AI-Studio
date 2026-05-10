import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import axios from 'axios';
import { config } from '../config/index.ts';
import logger from '../utils/logger.ts';

class TTSService {
  public async generateSpeech(text: string, voice = "id-ID-ArdiNeural", emotion = "neutral") {
    const ttsHandler = new MsEdgeTTS();
    
    let pitch = "+0Hz";
    let rate = "+0%";

    const e = emotion.toLowerCase();
    if (e.includes('excited') || e.includes('energetic')) {
      pitch = "+2Hz";
      rate = "+15%";
    } else if (e.includes('sad') || e.includes('calm') || e.includes('mysterious')) {
      pitch = "-2Hz";
      rate = "-10%";
    }

    try {
      await ttsHandler.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = ttsHandler.toStream(text, { pitch, rate });
      
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const audioBuffer = Buffer.concat(chunks);
      
      return { 
        audio: `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`, 
        provider: "ms-edge",
        voice
      };
    } catch (err: any) {
      logger.warn(`[AUDIO] Edge Neural Failed, trying OpenAI fallback: ${err.message}`);
      return this.openAIFallback(text);
    }
  }

  private async openAIFallback(text: string) {
    const openAIKey = config.openaiApiKey;
    if (!openAIKey) throw new Error("TTS Failed and no OpenAI Fallback key");

    const response = await axios.post(
      "https://api.openai.com/v1/audio/speech",
      { model: "tts-1", input: text, voice: "alloy" },
      { headers: { Authorization: `Bearer ${openAIKey}` }, responseType: "arraybuffer" }
    );
    
    return { 
      audio: `data:audio/mpeg;base64,${Buffer.from(response.data).toString('base64')}`, 
      provider: "openai" 
    };
  }
}

export const ttsService = new TTSService();
