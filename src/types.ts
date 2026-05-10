export type PipelineStatus = 'DISCOVERY' | 'DRAFTING' | 'PRODUCTION' | 'RENDERING' | 'READY' | 'PUBLISHED';

export interface Trend {
  id: string;
  source: 'Google Trends' | 'Reddit' | 'YouTube';
  topic: string;
  viralScore: number;
  timestamp: string;
}

export interface StoryboardScene {
  scene: number;
  duration?: number;
  visual: string;
  motion: 'slow push-in' | 'parallax' | 'handheld' | 'drone fly-through' | 'dolly zoom' | 'orbit' | 'static';
  audio: string;
  voiceTone?: string;
  musicMood?: string;
  sfx?: string[];
  emotion?: string;
  transition?: string;
  imageUrl?: string;
  videoUrl?: string;
  videoKeyword?: string;
  voiceUrl?: string;
}

export interface ContentPiece {
  id: string;
  trendId: string;
  title: string;
  script: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoStoryboard?: StoryboardScene[];
  status: PipelineStatus;
  progress: number;
  downloadUrl?: string;
  createdAt: string;
  publishedAt?: string;
  publishedUrl?: string;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'IDLE' | 'WORKING' | 'SUCCESS' | 'ERROR';
  lastAction: string;
}
