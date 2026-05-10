import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateContent = async (prompt: string, systemInstruction?: string, retries = 5) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: systemInstruction || "Anda adalah pakar strategi dan kreator konten AI yang ahli dalam bahasa Indonesia.",
          responseMimeType: "application/json",
        },
      });
      
      let text = response.text || '';
      
      // Remove markdown json block if present
      text = text.replace(/^```[a-z]*\nM?/, '').replace(/\n?```$/, '').trim();
      
      try {
        // First try direct parse
        return JSON.parse(text);
      } catch (e1) {
        try {
          // Find array brackets
          const start = text.indexOf('[');
          const end = text.lastIndexOf(']');
          if (start !== -1 && end !== -1 && end > start) {
            const jsonArrStr = text.substring(start, end + 1);
            return JSON.parse(jsonArrStr);
          }
          
          // Find object braces if no array
          const startObj = text.indexOf('{');
          const endObj = text.lastIndexOf('}');
          if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
            const jsonObjStr = text.substring(startObj, endObj + 1);
            return JSON.parse(jsonObjStr);
          }
        } catch (e2) {
          console.warn("Could not parse JSON from Gemini response", e2, "Raw text:", text);
          return null;
        }
        return null;
      }
    } catch (error: any) {
      const errorString = JSON.stringify(error);
      const isRateLimit = 
        error.message?.includes('429') || 
        error.status === 429 || 
        error.statusCode === 429 ||
        errorString.includes('429') ||
        errorString.includes('RESOURCE_EXHAUSTED') ||
        errorString.includes('quota');

      if (isRateLimit && i < retries) {
        // Exponential backoff with jitter, but more aggressive for 429
        const delay = Math.pow(2, i) * 5000 + Math.random() * 2000; 
        console.warn(`Gemini Rate Limit / Quota hit (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${retries})`);
        await sleep(delay);
        continue;
      }

      console.error("Gemini Error Detail:", errorString);
      return null;
    }
  }
  return null;
};

export const generateImage = async (prompt: string) => {
  try {
    const cleanPrompt = prompt
      .replace(/[\n\r]/g, " ") // Hapus newline
      .replace(/\s+/g, " ")    // Hapus spasi ganda
      .replace(/["']/g, "")
      .substring(0, 300)
      .trim();
      
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    
    // Seed unik untuk variasi artistik
    const seed = Math.floor(Math.random() * 1000000000);
    
    // Menggunakan Pollinations Flux dengan parameter yang lebih stabil (Desktop 16:9)
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1280&height=720&seed=${seed}&model=flux&nologo=true`;
    
    return imageUrl;
  } catch (error) {
    console.error("Visual Pipeline Failure:", error);
    return "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1920";
  }
};

// Neural Cinema Engine: Mencari klip video relevan berdasarkan kata kunci
export const findVideoClip = (description: string, keyword?: string): string | null => {
  const desc = description.toLowerCase();
  const kw = keyword?.toLowerCase() || '';
  
  // Mapping kata kunci ke public generic clips (Reliable CORS & uptime)
  const clips: Record<string, string> = {
    'tech': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'future': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'nature': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'water': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'sky': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'city': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'space': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'business': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'finance': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'gaming': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'epic': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'fire': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'abstract': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'urban': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    'cinematic': 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4'
  };

  // Default to null to trigger AI Image generation for unique content as fallback
  // The static generic clips are removed to avoid repetitive content.
  return null;
};
