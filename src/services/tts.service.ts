export const ttsService = {
  stop() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  },

  async speak(text: string, options: { tone?: string, onEnd?: () => void, cachedAudioUrl?: string } = {}) {
    const { tone, onEnd, cachedAudioUrl } = options;
    this.stop();

    const cleanText = text
      .replace(/^(Scene|Scena|Bagian|Pemandangan|Narator|Narrator|Visual|Prompt|Scene\s*\d+)\s*[:\s-]+/i, "")
      .replace(/\[.*?\]/g, "")
      .trim();

    if (cachedAudioUrl) {
      try {
        const audio = new Audio(cachedAudioUrl);
        audio.onended = () => { if (onEnd) onEnd(); };
        audio.onerror = (e) => {
          console.warn("Cached audio failed to load, falling back to API...", e);
          this.attemptTtsApi(cleanText, tone, onEnd);
        };
        await audio.play();
        return audio;
      } catch (err) {
        console.warn("Cached audio play error:", err);
      }
    }

    return this.attemptTtsApi(cleanText, tone, onEnd);
  },

  async attemptTtsApi(text: string, tone?: string, onEnd?: () => void) {
    try {
      const audioUrl = await this.generateAudio(text, tone);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.onended = () => { if (onEnd) onEnd(); };
        audio.play();
        return audio;
      }
    } catch (e) {
      console.warn("Backend TTS failed, falling back to browser synthesis.", e);
    }

    this.speakBrowser(text, tone, onEnd);
    return null;
  },

  async generateAudio(text: string, tone?: string): Promise<string | null> {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text, 
          emotion: tone,
          voice: "id-ID-ArdiNeural"
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.audio;
      }
    } catch (e) {
      console.warn("TTS generation failed:", e);
    }
    return null;
  },

  speakBrowser(text: string, tone?: string, onEnd?: () => void) {
    if (!window.speechSynthesis) return;

    const startSpeaking = () => {
      // Clear the listener once triggered to avoid accumulation
      window.speechSynthesis.onvoiceschanged = null;
      
      const utterance = new SpeechSynthesisUtterance(text.replace(/["']/g, "").trim());
      const availableVoices = window.speechSynthesis.getVoices();
      
      const idVoice = availableVoices.find(v => v.lang.startsWith('id-ID') && 
        (v.name.includes('Ardi') || v.name.includes('David') || v.name.includes('Neural') || v.name.includes('Natural')));
      
      if (idVoice) utterance.voice = idVoice;
      
      const t = tone?.toLowerCase() || '';
      if (t.includes('dramatic')) { utterance.pitch = 0.85; utterance.rate = 0.88; }
      else if (t.includes('energetic')) { utterance.pitch = 1.05; utterance.rate = 1.1; }
      else { utterance.pitch = 1.0; utterance.rate = 0.95; }
      
      utterance.volume = 1;
      if (onEnd) utterance.onend = onEnd;
      
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = startSpeaking;
    } else {
      startSpeaking();
    }
  }
}
