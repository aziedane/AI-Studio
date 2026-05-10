import React from 'react';

interface Props {
  isAutoRunning: boolean;
}

export const StatusIndicator: React.FC<Props> = ({ isAutoRunning }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isAutoRunning ? 'bg-green-400' : 'bg-blue-400'} opacity-75`}></span>
        <span className={`relative inline-flex rounded-full h-2 w-2 ${isAutoRunning ? 'bg-green-500' : 'bg-blue-500'}`}></span>
      </span>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">
        System {isAutoRunning ? "Active: Producing" : "Standby: Listening"}
      </span>
    </div>
  );
};
