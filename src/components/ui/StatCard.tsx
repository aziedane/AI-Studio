import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'purple' | 'amber' | 'red';
}

const colorMap = {
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-400' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-400' },
  red: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon: Icon, color = 'blue' }) => {
  const theme = colorMap[color];

  return (
    <div className="bg-[#141414] border border-[#2A2A2A] p-4 flex flex-col justify-between group hover:border-[#4A4A4A] transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 ${theme.bg} rounded-lg group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${theme.text}`} />
        </div>
        <span className="text-[10px] font-mono text-[#666] tracking-widest uppercase">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-mono text-white tracking-tight">{value}</span>
        {unit && <span className="text-xs font-mono text-[#666]">{unit}</span>}
      </div>
    </div>
  );
};
