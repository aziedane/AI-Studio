import React from 'react';
import { TrendingUp } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { ActionButton } from '../ui/ActionButton';
import { supabaseService } from '../../services/supabase.service';
import { aiService } from '../../services/ai.service';
import { Trend } from '../../types';

const NICHES = ['Umum', 'Teknologi', 'Gaya Hidup', 'Game', 'Kuliner', 'Otomotif', 'Keuangan', 'Pendidikan', 'Wisata', 'Kesehatan'];

export const TrendList: React.FC = () => {
  const { trends, selectedNiche, setSelectedNiche, setActiveTab, user, addLog, updateAgent } = useAppStore();

  const collectTrends = async () => {
    if (!user) return;
    updateAgent('scout', { status: 'WORKING', lastAction: `Memindai Tren: ${selectedNiche}...` });
    addLog(`Memulai pemindaian tren global untuk niche: ${selectedNiche}`, "process");
    
    try {
      const newTrends = await aiService.scoutTrends(selectedNiche);
      if (newTrends.length > 0) {
        await supabaseService.saveTrendsBatch(newTrends, user.id);
        addLog(`Berhasil menemukan ${newTrends.length} tren baru.`, "success");
        updateAgent('scout', { status: 'SUCCESS', lastAction: 'Database Diperbarui' });
      }
    } catch (e) {
      addLog("Gagal memindai tren.", "info");
      updateAgent('scout', { status: 'ERROR', lastAction: 'Koneksi Gagal' });
    }
  };

  const generateBrief = async (trend: Trend) => {
    if (!user) return;
    setActiveTab('feed');
    updateAgent('architect', { status: 'WORKING', lastAction: 'Membangun Konsep Konten...' });
    addLog(`Arsitek AI mulai merancang konten untuk: ${trend.topic}`, "process");
    
    try {
      const brief = await aiService.draftScript(trend);
      if (brief) {
        await supabaseService.saveContentItem(brief as any, user.id);
        addLog(`Konten brief selesai dibuat: ${brief.title}`, "success");
        updateAgent('architect', { status: 'SUCCESS', lastAction: 'Konsep Matang & Terarsip' });
      }
    } catch (e) {
      addLog("Gagal membuat naskah.", "info");
      updateAgent('architect', { status: 'ERROR', lastAction: 'Gagal Menulis' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-[#181818] p-4 border border-[#222] gap-4">
        <div>
          <h3 className="text-sm font-mono font-bold text-white uppercase tracking-widest">Database Tren Global</h3>
          <p className="text-[10px] font-mono text-[#666] uppercase mt-1">Status: Memindai Sinkronisasi Real-time</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-[#0C0C0C] px-3 py-1.5 border border-[#2A2A2A]">
            <span className="text-[9px] font-mono text-[#666] uppercase tracking-widest">Niche:</span>
            <select 
              value={selectedNiche}
              onChange={(e) => setSelectedNiche(e.target.value)}
              className="bg-transparent text-white font-mono text-[10px] uppercase tracking-widest outline-none cursor-pointer"
            >
              {NICHES.map(n => (
                <option key={n} value={n} className="bg-[#0C0C0C]">{n}</option>
              ))}
            </select>
          </div>
          <ActionButton onClick={collectTrends} icon={TrendingUp} variant="secondary">Sinkronisasi Ulang</ActionButton>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {trends.map((trend) => (
          <div key={trend.id} className="bg-[#0D0D0D] border border-[#1A1A1A] p-6 hover:border-white/20 transition-all group">
            <div className="flex justify-between items-start mb-4">
               <div className="px-2 py-1 bg-white/5 border border-white/10 text-[9px] font-mono text-white uppercase tracking-widest">
                 {trend.source}
               </div>
               <div className="text-emerald-500 font-mono text-xs">
                 Score: {trend.viralScore}
               </div>
            </div>
            <h4 className="text-lg font-mono text-white uppercase tracking-tight mb-4 leading-tight group-hover:text-amber-400 transition-colors">
              {trend.topic}
            </h4>
            <div className="flex justify-between items-center pt-4 border-t border-[#1A1A1A]">
               <span className="text-[9px] font-mono text-[#444] uppercase">{new Date(trend.timestamp).toLocaleTimeString()}</span>
               <button 
                onClick={() => generateBrief(trend)}
                className="text-[9px] font-mono text-white uppercase tracking-[0.2em] hover:underline"
               >
                  Generate Konten Brief →
               </button>
            </div>
          </div>
        ))}
        {trends.length === 0 && (
          <div className="col-span-full py-12 text-center opacity-30 italic font-mono text-xs uppercase tracking-widest border border-dashed border-[#222]">
            Database kosong. Inisialisasi pemindaian untuk mengisi data.
          </div>
        )}
      </div>
    </div>
  );
};
