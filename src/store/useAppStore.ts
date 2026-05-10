import { create } from 'zustand';
import { User } from 'firebase/auth';
import { ContentPiece, Trend, AgentStatus } from '../types';

interface AppState {
  // Data
  trends: Trend[];
  contentItems: ContentPiece[];
  user: User | null;
  isAuthLoading: boolean;
  agents: AgentStatus[];
  logs: { msg: string; time: string; type: string }[];
  isAutoRunning: boolean;
  selectedVideoId: string | null;
  renderProgress: number;
  isRendering: boolean;
  notification: { msg: string; type: 'success' | 'info' | 'error' } | null;
  ytConnected: boolean;
  currentScene: number;
  activeStepId: string | null;
  activeTab: 'feed' | 'trends' | 'analytics';
  selectedNiche: string;

  // Actions
  setTrends: (trends: Trend[]) => void;
  setContentItems: (items: ContentPiece[]) => void;
  setUser: (user: User | null) => void;
  setIsAuthLoading: (loading: boolean) => void;
  updateAgent: (id: string, updates: Partial<AgentStatus>) => void;
  addLog: (msg: string, type?: string) => void;
  setIsAutoRunning: (isRunning: boolean) => void;
  setSelectedVideoId: (id: string | null) => void;
  setRenderProgress: (progress: number) => void;
  setIsRendering: (isRendering: boolean) => void;
  setNotification: (notif: { msg: string; type: 'success' | 'info' | 'error' } | null) => void;
  setYtConnected: (connected: boolean) => void;
  setCurrentScene: (scene: number) => void;
  setActiveStepId: (id: string | null) => void;
  setActiveTab: (tab: 'feed' | 'trends' | 'analytics') => void;
  setSelectedNiche: (niche: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  trends: [],
  contentItems: [],
  user: null,
  isAuthLoading: true,
  agents: [
    { id: 'scout', name: 'Pencari Tren', status: 'IDLE', lastAction: 'Siaga' },
    { id: 'architect', name: 'Arsitek Naskah', status: 'IDLE', lastAction: 'Siaga' },
    { id: 'producer', name: 'Produser Visual', status: 'IDLE', lastAction: 'Siaga' },
    { id: 'thumbnail', name: 'Pembuat Thumbnail', status: 'IDLE', lastAction: 'Siaga' },
    { id: 'publisher', name: 'Unduh / Upload', status: 'IDLE', lastAction: 'Siaga' },
  ],
  logs: [],
  isAutoRunning: false,
  selectedVideoId: null,
  renderProgress: 0,
  isRendering: false,
  notification: null,
  ytConnected: false,
  currentScene: 0,
  activeStepId: null,
  activeTab: 'feed',
  selectedNiche: 'Umum',

  setTrends: (trends) => set({ trends }),
  setContentItems: (contentItems) => set({ contentItems }),
  setUser: (user) => set({ user }),
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  updateAgent: (id, updates) => set((state) => ({
    agents: state.agents.map(a => a.id === id ? { ...a, ...updates } : a)
  })),
  addLog: (msg, type = 'info') => set((state) => ({
    logs: [{ msg, time: new Date().toLocaleTimeString(), type }, ...state.logs].slice(0, 100)
  })),
  setIsAutoRunning: (isAutoRunning) => set({ isAutoRunning }),
  setSelectedVideoId: (selectedVideoId) => set({ selectedVideoId }),
  setRenderProgress: (renderProgress) => set({ renderProgress }),
  setIsRendering: (isRendering) => set({ isRendering }),
  setNotification: (notification) => set({ notification }),
  setYtConnected: (ytConnected) => set({ ytConnected }),
  setCurrentScene: (currentScene) => set({ currentScene }),
  setActiveStepId: (activeStepId) => set({ activeStepId }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedNiche: (selectedNiche) => set({ selectedNiche }),
}));
