import React, { useState, useEffect, useRef } from 'react';
import { 
  Cpu, 
  Radio, 
  Database, 
  Video, 
  Settings, 
  Youtube,
  Play,
  LogOut,
  LogIn,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from './store/useAppStore';
import { firebaseService } from './services/firebase.service';
import { aiService } from './services/ai.service';
import { ttsService } from './services/tts.service';
import { useContentPipeline } from './hooks/useContentPipeline';
import { StatCard } from './components/ui/StatCard';
import { ActionButton } from './components/ui/ActionButton';
import { AgentGrid } from './components/dashboard/AgentGrid';
import { LogPanel } from './components/dashboard/LogPanel';
import { TrendList } from './components/dashboard/TrendList';
import { FeedList } from './components/dashboard/FeedList';
import { RenderOverlay } from './components/render/RenderOverlay';
import { VideoPreviewModal } from './components/render/VideoPreviewModal';
import { SettingsPanel } from './components/layout/SettingsPanel';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const store = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { renderVideo, finalizePipeline, produceMedia, downloadVideo } = useContentPipeline(canvasRef);
  const [showSettings, setShowSettings] = useState(false);
  const [discoveryRate, setDiscoveryRate] = useState(840);
  const [productionLoad, setProductionLoad] = useState(12);
  const [aiIntegrity, setAiIntegrity] = useState(100);

  // Stats Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setDiscoveryRate(prev => Math.max(700, Math.min(1500, prev + (Math.random() > 0.5 ? 1 : -1))));
      setProductionLoad(prev => {
        if (store.isRendering) return prev;
        return prev + (Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : -1) : 0);
      });
      setAiIntegrity(prev => Math.max(99, Math.min(100, prev + (Math.random() - 0.5) * 0.05)));
    }, 3000);
    return () => clearInterval(interval);
  }, [store.isRendering]);

  // Auth & Data Sync
  useEffect(() => {
    if (store.notification) {
      const timer = setTimeout(() => store.setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [store.notification]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      store.setUser(u);
      store.setIsAuthLoading(false);
    });

    // Check YouTube status
    const checkYtStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        store.setYtConnected(data.connected);
      } catch (err) {
        console.error("Failed to check YT status", err);
      }
    };
    checkYtStatus();

    // Listen for OAuth success message
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        store.setYtConnected(true);
        store.addLog("YouTube berhasil terhubung!", "success");
        store.setNotification({ msg: "YouTube Connected!", type: "success" });
      }
    };
    window.addEventListener('message', handleMessage);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  useEffect(() => {
    if (!store.user) return;
    const unsubTrends = firebaseService.syncTrends(store.user.uid, store.setTrends);
    const unsubContent = firebaseService.syncContentItems(store.user.uid, store.setContentItems);
    return () => {
      unsubTrends();
      unsubContent();
    };
  }, [store.user]);

  // Auto-run Cycle
  const runAutonomousCycle = async () => {
    if (!store.user) {
      store.addLog("AUTONOMOUS CYCLE: Harap login terlebih dahulu.", "info");
      store.setNotification({ msg: "Silakan Login Dulu", type: "info" });
      return;
    }
    
    if (store.isAutoRunning) {
      console.warn("Autonomous Cycle already running!");
      return;
    }

    store.setIsAutoRunning(true);
    store.addLog("MENJALANKAN SIKLUS OTOMATIS: INISIALISASI...", "process");
    console.log("[AUTO] Cycle Started");

    try {
      // 1. SCOUT PHASE
      store.addLog("AGEN SCOUT: Memindai tren terbaru di Indonesia...", "process");
      store.updateAgent('scout', { status: 'WORKING', lastAction: 'Scanning Indonesia Trends...' });
      const newTrends = await aiService.scoutTrends(store.selectedNiche || 'Umum');
      
      if (!newTrends || newTrends.length === 0) {
        throw new Error("Tidak ada tren baru ditemukan untuk niche: " + (store.selectedNiche || 'Umum'));
      }
      
      await firebaseService.saveTrendsBatch(newTrends, store.user.uid);
      store.updateAgent('scout', { status: 'SUCCESS', lastAction: 'Data Updated' });
      
      // Select top trend
      const topTrend = newTrends[0];
      store.addLog(`AGEN ARCHITECT: Merancang naskah untuk "${topTrend.topic}"`, "process");
      store.updateAgent('architect', { status: 'WORKING', lastAction: 'Designing Script...' });

      // 2. ARCHITECT PHASE
      const brief = await aiService.draftScript(topTrend);
      if (!brief) throw new Error("Gagal merancang naskah.");
      
      await firebaseService.saveContentItem(brief as any, store.user.uid);
      store.updateAgent('architect', { status: 'SUCCESS', lastAction: 'Script Ready' });

      // 3. PRODUCER PHASE
      store.addLog("AGEN PRODUCER: Membuat aset visual dan narasi...", "process");
      const producedItem = await produceMedia(brief.id!, brief as any);
      if (!producedItem) throw new Error("Gagal memproduksi media.");

      // 4. PUBLISHER PHASE (Auto Render)
      store.addLog("AGEN PUBLISHER: Menjalankan mesin render...", "process");
      const renderSuccess = await renderVideo(producedItem.id, producedItem as any);
      if (!renderSuccess) throw new Error("Gagal merender video.");
      
      store.addLog("SIKLUS OTOMATIS SELESAI: Konten siap dipublikasikan.", "success");
      store.setNotification({ msg: "Siklus Otomatis Selesai!", type: "success" });

    } catch (e: any) {
      console.error("Auto cycle error:", e);
      store.addLog(`Siklus otomatis terhenti: ${e.message || "Unknown error"}`, "info");
    } finally {
      store.setIsAutoRunning(false);
    }
  };

  const connectYoutube = async () => {
    try {
      const response = await fetch('/api/auth/youtube');
      if (!response.ok) throw new Error("Gagal mengambil URL otentikasi");
      const { url } = await response.json();
      
      if (!url) throw new Error("URL otentikasi tidak ditemukan");

      const width = 600, height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(url, 'YouTube Auth', `width=${width},height=${height},left=${left},top=${top}`);
      
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        store.addLog("Popup diblokir! Silakan izinkan popup untuk menghubungkan YouTube.", "info");
        window.location.href = url; // Fallback to direct navigation if popup is blocked
      }
    } catch (err: any) {
      console.error("YouTube Auth Error:", err);
      store.addLog(`Gagal menghubungkan YouTube: ${err.message}`, "error");
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#D1D1D1] font-sans selection:bg-white selection:text-black">
      <RenderOverlay canvasRef={canvasRef} />
      <VideoPreviewModal />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Header */}
      <header className="border-b border-[#1A1A1A] p-4 flex justify-between items-center bg-[#0C0C0C]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-white flex items-center justify-center rounded-sm">
            <Cpu className="text-black w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-mono text-white tracking-tighter uppercase">AI STUDIO PRO <span className="text-[#444] font-light">v5.0.0</span></h1>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${store.isAutoRunning ? 'bg-green-400' : 'bg-blue-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${store.isAutoRunning ? 'bg-green-500' : 'bg-blue-500'}`}></span>
              </span>
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">
                Sistem {store.isAutoRunning ? "Aktif: Memproduksi" : "Siaga: Mendengarkan"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {store.isAuthLoading ? (
            <div className="text-[10px] font-mono text-[#666] animate-pulse uppercase tracking-widest">Memuat Sesi...</div>
          ) : store.user ? (
            <div className="flex items-center gap-3 pr-2 border-r border-[#2A2A2A]">
               <div className="flex flex-col items-end">
                  <span className="text-[10px] font-mono text-white truncate max-w-[120px]">{store.user.displayName}</span>
                  <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-widest">Connected</span>
               </div>
               <button onClick={() => firebaseService.logout()} className="p-2 text-[#666] hover:text-red-400 transition-colors">
                  <LogOut className="w-5 h-5" />
               </button>
            </div>
          ) : (
            <button onClick={() => firebaseService.login()} className="flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest bg-blue-600 text-white hover:bg-blue-500 transition-all border border-blue-400">
              <LogIn className="w-3 h-3" /> Masuk
            </button>
          )}

          <button 
            onClick={connectYoutube}
            className={`flex items-center gap-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest border transition-all ${
              store.ytConnected ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500 hover:bg-red-500 hover:text-white'
            }`}
          >
            <Youtube className="w-3 h-3" />
            {store.ytConnected ? 'YouTube Connected' : 'Connect YouTube'}
          </button>
          <div className="h-4 w-px bg-[#2A2A2A]" />
          <ActionButton onClick={runAutonomousCycle} icon={Play} disabled={store.isAutoRunning}>
            Siklus Otomatis
          </ActionButton>
          <div className="h-4 w-px bg-[#2A2A2A]" />
          <button onClick={() => setShowSettings(true)} className="p-2 text-[#666] hover:text-white transition-colors">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Laju Penemuan" value={discoveryRate} unit="tren/jam" icon={Radio} color="emerald" />
            <StatCard label="Beban Sistem" value={productionLoad} unit="%" icon={Database} color="blue" />
            <StatCard label="Integritas AI" value={aiIntegrity.toFixed(1)} unit="%" icon={CheckCircle2} color="purple" />
            <StatCard label="Total Produksi" value={store.contentItems.length} unit="video" icon={Video} color="amber" />
          </div>
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
                    className={`text-[11px] font-mono font-bold uppercase tracking-[0.2em] pb-4 -mb-4 transition-all ${
                      store.activeTab === tab ? 'text-white border-b-2 border-white' : 'text-[#444] hover:text-[#777]'
                    }`}
                  >
                    {tab === 'feed' ? 'Umpan Konten' : tab === 'trends' ? 'Tren Terkini' : 'Analitik'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
              {store.activeTab === 'feed' && (
                <FeedList 
                  onRender={renderVideo} 
                  onFinalize={finalizePipeline} 
                  onProduce={produceMedia} 
                  onDownload={downloadVideo}
                />
              )}
              {store.activeTab === 'trends' && <TrendList />}
              {store.activeTab === 'analytics' && (
                <div className="p-20 text-center opacity-20 italic font-mono text-xs uppercase tracking-widest">
                  Analitik visual sedang dioptimalkan...
                </div>
              )}
            </div>
          </section>

          <section className="h-[250px] bg-[#0D0D0D] border border-[#1A1A1A] flex flex-col">
            <div className="p-3 border-b border-[#1A1A1A] flex justify-between items-center px-4 bg-[#111]">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-[0.25em] text-[#666]">Trend Ingestion Stream</h3>
            </div>
            <div className="flex-1 overflow-x-auto p-4 flex gap-4 custom-scrollbar">
              {store.trends.map((trend) => (
                <div 
                  key={trend.id}
                  className="min-w-[220px] border border-[#1C1C1C] p-4 bg-black/40 flex flex-col justify-between hover:border-[#333] transition-all cursor-pointer"
                  onClick={() => { store.setActiveTab('trends'); }}
                >
                  <p className="text-[10px] font-mono text-green-500 mb-2">SCORE: {trend.viralScore}</p>
                  <h5 className="text-xs font-mono font-bold text-white uppercase tracking-tight line-clamp-2">{trend.topic}</h5>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      <AnimatePresence>
        {store.notification && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className="fixed bottom-10 right-10 z-[100] bg-white text-black p-4 font-mono shadow-[10px_10px_0px_0px_rgba(255,255,255,0.1)] border-l-8 border-green-500"
          >
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <p className="text-xs font-bold uppercase">{store.notification.msg}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
