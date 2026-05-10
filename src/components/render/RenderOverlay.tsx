import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

interface RenderOverlayProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
}

export const RenderOverlay: React.FC<RenderOverlayProps> = ({ canvasRef }) => {
  const { isRendering, renderProgress } = useAppStore();

  return (
    <AnimatePresence>
      {isRendering && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-3xl flex flex-col items-center justify-center p-10"
        >
          <div className="w-full max-w-xl space-y-8 text-center">
            <div className="relative inline-block">
               <div className="w-20 h-20 border-2 border-white/5 border-t-white rounded-full animate-spin mx-auto" />
               <Video className="absolute inset-0 m-auto w-6 h-6 text-white animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-mono text-white uppercase tracking-tighter">Backend Production Active</h2>
              <p className="text-[#444] font-mono text-[10px] uppercase tracking-widest">Server sedang menyusun frame dan narasi audio secara utuh...</p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end text-[10px] font-mono text-[#666] uppercase tracking-widest">
                 <span>Batch Rendering Pipeline</span>
                 <span className="text-white font-bold">{renderProgress}%</span>
              </div>
              <div className="h-0.5 bg-white/5 w-full overflow-hidden">
                <motion.div 
                   transition={{ duration: 0.5 }}
                   initial={{ width: 0 }}
                   animate={{ width: `${renderProgress}%` }}
                   className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                />
              </div>
            </div>

            <div className="p-4 border border-[#222] bg-[#0c0c0c] text-[#555] font-mono text-[9px] uppercase leading-relaxed tracking-tighter">
              Aman untuk memindahkan tab. Proses render dilakukan secara otonom di server.
              <br/><br/>
              Lihat panel LOG untuk detil progres per adegan.
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
