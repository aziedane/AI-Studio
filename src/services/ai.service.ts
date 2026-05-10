import { generateContent, generateImage, findVideoClip } from '../lib/gemini';
import { Trend, ContentPiece, StoryboardScene } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const aiService = {
  // Agent: Scout (Pencari Tren)
  async scoutTrends(niche: string): Promise<Trend[]> {
    const prompt = `Cari 5 tren terbaru dan paling viral di INDONESIA untuk kategori/niche: ${niche}. 
    Tren harus spesifik untuk audiens Indonesia dan berpotensi untuk dibuat konten video pendek.
    Seluruh output topik harus menggunakan Bahasa Indonesia yang menarik.
    Output harus berupa JSON array dengan format: 
    [{"topic": "judul tren dalam Bahasa Indonesia", "source": "Google Trends Indonesia|Twitter ID|TikTok ID|YouTube ID", "viralScore": 0-100}]`;

    const systemInstruction = "Anda adalah Scout AI yang ahli memantau tren di Indonesia secara real-time. Anda memahami budaya lokal dan apa yang sedang viral di masyarakat Indonesia.";
    const result = await generateContent(prompt, systemInstruction);
    
    if (!result || !Array.isArray(result)) return [];

    return result.map(t => ({
      ...t,
      id: uuidv4(),
      timestamp: new Date().toISOString()
    }));
  },

  // Agent: Architect (Arsitek Naskah & Storyboard)
  async draftScript(trend: Trend): Promise<Partial<ContentPiece> | null> {
    const prompt = `Buat naskah video cinematic pendek (60-90 detik) untuk tren: "${trend.topic}".
    Naskah harus SEPENUHNYA menggunakan Bahasa Indonesia.
    Naskah harus memiliki hook yang kuat (dalam Bahasa Indonesia), isi yang edukatif/menghibur, dan call to action yang natural bagi orang Indonesia.
    Sediakan juga 10-12 adegan storyboard (scenes).
    
    Format JSON:
    {
      "title": "judul video menarik dalam Bahasa Indonesia",
      "script": "full naskah narasi lengkap dalam Bahasa Indonesia",
      "videoStoryboard": [
        {
          "scene": 1,
          "visual": "deskripsi visual detail dalam Bahasa Inggris (untuk generator gambar/video)",
          "motion": "slow push-in|parallax|handheld|drone fly-through|dolly zoom|orbit|static",
          "audio": "narasi yang dibacakan untuk adegan ini dalam Bahasa Indonesia",
          "voiceTone": "dramatic|energetic|calm|mysterious",
          "videoKeyword": "1-2 word English keyword for stock video search (e.g. 'cyberpunk city', 'forest aerial', 'smart watch')"
        }
      ]
    }`;

    const systemInstruction = "Anda adalah Arsitek Konten AI yang ahli dalam storytelling visual dan penulisan naskah video pendek menggunakan Bahasa Indonesia yang gaul namun profesional.";
    const result = await generateContent(prompt, systemInstruction);
    
    if (!result) return null;

    return {
      ...result,
      trendId: trend.id,
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      status: 'PRODUCTION',
      progress: 0
    };
  },

  // Agent: Producer (Produser Visual)
  async produceAssets(scenes: StoryboardScene[]): Promise<StoryboardScene[]> {
    const producerTasks = scenes.map(async (scene, idx) => {
      // 1. Try to find a real video clip from Pexels via our API
      let videoUrl: string | null = null;
      try {
        const query = scene.videoKeyword || scene.visual.split(' ').slice(0, 4).join(' ');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const res = await fetch(`/api/stock/video?query=${encodeURIComponent(query)}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        const data = await res.json();
        if (data.url) {
          videoUrl = data.url;
          console.log(`[PRODUCER] Video found for scene #${idx + 1}`);
        }
      } catch (e) {
        console.warn(`[PRODUCER] Pexels fetch failed for scene #${idx + 1}, falling back`, e);
      }

      if (!videoUrl) {
        videoUrl = findVideoClip(scene.visual, scene.videoKeyword);
      }
      
      // 2. Generate Image (always generate as fallback or background)
      let imageUrl = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920";
      try {
        imageUrl = await generateImage(scene.visual);
      } catch (e) {
        console.warn(`[PRODUCER] Image generation failed for scene #${idx + 1}`, e);
      }
      
      return {
        ...scene,
        videoUrl: videoUrl || null,
        imageUrl
      };
    });

    return Promise.all(producerTasks);
  },

  // Agent: Thumbnail Creator
  async createThumbnail(title: string, summary: string): Promise<string> {
    const prompt = `High-end cinematic YouTube thumbnail for: "${title}". 
    Dramatic lighting, professional composition, 8k, photorealistic, no text labels. 
    Focus on: ${summary}`;
    return generateImage(prompt);
  }
};
