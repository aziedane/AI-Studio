import React from 'react';
import { Terminal, Activity } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const AgentGrid: React.FC = () => {
  const { agents, activeStepId } = useAppStore();

  return (
    <section className="bg-[#111] border border-[#1A1A1A] overflow-hidden">
      <div className="border-b border-[#1A1A1A] p-3 flex justify-between items-center bg-[#181818]">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#666]" />
          <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-[#999]">Agen Neural</h3>
        </div>
      </div>
      <div className="divide-y divide-[#1A1A1A]">
        {agents.map((agent) => (
          <div 
            key={agent.id} 
            className={`p-4 flex items-center justify-between transition-colors group ${activeStepId === agent.id ? 'bg-[#1A1A1A] border-l-2 border-white' : 'hover:bg-[#151515]'}`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-1 h-1 rounded-full ${
                agent.status === 'WORKING' ? 'bg-blue-500 animate-pulse' : 
                agent.status === 'SUCCESS' ? 'bg-green-500' : 
                agent.status === 'ERROR' ? 'bg-red-500' : 'bg-[#333]'
              }`} />
              <div>
                <p className={`text-xs font-mono font-bold uppercase tracking-wider ${activeStepId === agent.id ? 'text-white' : 'text-[#999]'}`}>{agent.name}</p>
                <p className="text-[10px] font-mono text-[#666] mt-0.5">{agent.lastAction}</p>
              </div>
            </div>
            <div className={activeStepId === agent.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}>
              <Activity className={`w-4 h-4 ${activeStepId === agent.id ? 'text-white' : 'text-[#333]'}`} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
