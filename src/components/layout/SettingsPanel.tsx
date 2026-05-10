import React from 'react';
import { X } from 'lucide-react';

interface SettingsPanelProps {
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
      <div className="bg-[#111] border border-[#2A2A2A] w-full max-w-md p-8 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-[#666] hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-mono uppercase tracking-[0.3em] text-white mb-6">Konfigurasi Sistem</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2">Endpoint API</label>
            <input type="text" readOnly value="/api/v1" className="w-full bg-[#0A0A0A] border border-[#1A1A1A] px-4 py-2 text-xs font-mono text-emerald-500" />
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2">Mesin Audio</label>
            <div className="text-xs font-mono text-white p-3 bg-[#181818] border border-[#1A1A1A]">Microsoft Edge Neural (Gratis/Aktif)</div>
          </div>
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-widest text-[#666] mb-2">Debug Mode</label>
            <div className="flex items-center gap-3">
               <div className="w-10 h-5 bg-emerald-500/20 border border-emerald-500/50 rounded-full relative">
                  <div className="absolute top-1 left-6 w-3 h-3 bg-emerald-500 rounded-full"></div>
               </div>
               <span className="text-[10px] font-mono text-emerald-500">ON</span>
            </div>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-full mt-8 border border-[#2A2A2A] py-3 text-[10px] font-mono uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all"
        >
          Simpan & Tutup
        </button>
      </div>
    </div>
  );
};
