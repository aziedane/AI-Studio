import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

interface ActionButtonProps {
  onClick: () => void;
  icon: LucideIcon;
  children: React.ReactNode;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

export const ActionButton: React.FC<ActionButtonProps> = ({ 
  onClick, 
  icon: Icon, 
  children, 
  disabled, 
  variant = 'primary' 
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`
      flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-widest transition-all
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      ${variant === "primary" 
        ? "bg-white text-black hover:bg-[#EAEAEA]" 
        : "border border-[#2A2A2A] text-[#999] hover:bg-[#1A1A1A] hover:text-white"}
    `}
  >
    {disabled ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
    {children}
  </button>
);
