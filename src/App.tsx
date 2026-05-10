import React, { useRef } from 'react';
import { 
  Cpu, 
  Settings, 
  Youtube,
  Play,
  LogOut,
  LogIn,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { useAuth } from './features/auth/hooks/useAuth';
import { useAutonomousCycle } from './features/pipeline/hooks/useAutonomousCycle';
import { useSyncData } from './features/dashboard/hooks/useSyncData';
import { useContentPipeline } from './hooks/useContentPipeline';
import { AgentGrid } from './components/dashboard/AgentGrid';
import { LogPanel } from './components/dashboard/LogPanel';
import { TrendList } from './components/dashboard/TrendList';
import { FeedList } from './components/dashboard/FeedList';
import { RenderOverlay } from './components/render/RenderOverlay';
import { VideoPreviewModal } from './components/render/VideoPreviewModal';
import { SettingsPanel } from './components/layout/SettingsPanel';
import { StatCard } from './components/ui/StatCard';
import { ActionButton } from './components/ui/ActionButton';
import { StatusIndicator } from './components/ui/StatusIndicator';

export default function App() {
  const store = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Custom Hooks (Decoupled Logic)
  const { login, logout, connectYoutube } = useAuth();
  const { renderVideo, finalizePipeline, produceMedia, downloadVideo } = useContentPipeline(canvasRef);
  const { runCycle } = useAutonomousCycle();
  useSyncData();

  // Unified UI Handler
  const [showSettings, setShowSettings] = React.useState(false);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#D1D1D1] font-sans selection:bg-white selection:text-black">
      <RenderOverlay canvasRef={canvasRef} />
      <VideoPreviewModal />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Persistent Header */}
      <header className="border-b border-[#1A1A1A] p-4 flex justify-between items-center bg-[#0C0C0C]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm">
            <Cpu className="text-black w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-mono text-white tracking-tighter uppercase">AI STUDIO PRO <span className="text-[#444] font-light">v5.0.0</span></h1>
            <StatusIndicator isAutoRunning={store.isAutoRunning} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {store.isAuthLoading ? (
            <div className="text-[10px] font-mono text-[#666] animate-pulse uppercase tracking-widest">Initialising...</div>
          ) : store.user ? (
            <div className="flex items-center gap-3 pr-2 border-r border-[#2A2A2A]">
               <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-white font-bold">{store.user.email}</span>
                  <span className="text-[8px] font-mono text-emerald-500 uppercase">Authenticated</span>
               </div>
               <button onClick={logout} className="p-2 text-[#666] hover:text-red-400 transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          ) : (
            <button onClick={login} className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 border border-blue-400">
              <LogIn className="w-3 h-3" /> Connect Account
            </button>
          )}

          <button onClick={connectYoutube} className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-all ${store.ytConnected ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'}`}>
            <Youtube className="w-3 h-3" /> {store.ytConnected ? 'YouTube Connected' : 'Connect YouTube'}
          </button>
          
          <div className="h-4 w-px bg-[#2A2A2A]" />
          <ActionButton onClick={runCycle} icon={Play} disabled={store.isAutoRunning}>Generate Video</ActionButton>
          <div className="h-4 w-px bg-[#2A2A2A]" />
          <button onClick={() => setShowSettings(true)} className="p-2 text-[#666] hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Dashboard Grid */}
      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <AgentGrid />
          <LogPanel />
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <section className="flex-1 bg-[#111] border border-[#1A1A1A] flex flex-col min-h-[500px]">
            <div className="border-b border-[#1A1A1A] p-4 flex justify-between items-center bg-[#151515]">
              <div className="flex gap-8">
                {['feed', 'trends', 'analytics'].map((tab) => (
                  <button 
                    key={tab}
                    onClick={() => store.setActiveTab(tab as any)}
                    className={`text-[11px] font-mono font-bold uppercase tracking-[0.2em] pb-4 -mb-4 transition-all ${store.activeTab === tab ? 'text-white border-b-2 border-white' : 'text-[#444] hover:text-[#777]'}`}
                  >
                    {tab === 'feed' ? 'Content Feed' : tab === 'trends' ? 'Market Trends' : 'Analytics'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              {store.activeTab === 'feed' && <FeedList onRender={renderVideo} onFinalize={finalizePipeline} onProduce={produceMedia} onDownload={downloadVideo} />}
              {store.activeTab === 'trends' && <TrendList />}
              {store.activeTab === 'analytics' && <div className="p-20 text-center opacity-20 italic font-mono text-xs uppercase tracking-widest">Visualising data streams...</div>}
            </div>
          </section>
        </div>
      </main>

      <NotificationHost />
    </div>
  );
}

const NotificationHost = () => {
  const store = useAppStore();

  React.useEffect(() => {
    if (store.notification) {
      const timer = setTimeout(() => {
        store.setNotification(null);
      }, 5000); // Dismiss after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [store.notification, store.setNotification]);

  return (
    <AnimatePresence>
      {store.notification && (
        <motion.div
          initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
          className="fixed bottom-10 right-10 z-[100] bg-white text-black p-4 font-mono shadow-xl border-l-8 border-green-500"
        >
          <p className="text-xs font-bold uppercase">{store.notification.msg}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
