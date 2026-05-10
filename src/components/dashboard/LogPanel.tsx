import React from 'react';
import { useAppStore } from '../../store/useAppStore';

export const LogPanel: React.FC = () => {
  const { logs } = useAppStore();

  return (
    <section className="bg-black border border-[#1A1A1A] h-[300px] flex flex-col">
      <div className="border-b border-[#1A1A1A] p-3 bg-[#0A0A0A] flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-red-500" />
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-mono ml-2 text-[#444] uppercase tracking-widest leading-none">Console.log</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-[10px] custom-scrollbar">
        {logs.length === 0 && <p className="text-[#333]"># Sistem diinisialisasi. Menunggu perintah...</p>}
        {logs.map((log, i) => (
          <div key={i} className={`flex gap-3 ${log.type === 'success' ? 'text-green-500' : log.type === 'process' ? 'text-blue-400' : 'text-[#666]'}`}>
            <span className="opacity-30">[{log.time}]</span>
            <span className={log.type === 'process' ? 'animate-pulse' : ''}>{log.msg}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
