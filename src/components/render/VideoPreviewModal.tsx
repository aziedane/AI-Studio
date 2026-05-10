import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

const SCENE_DURATION = 12000;

export const VideoPreviewModal: React.FC = () => {
  const { selectedVideoId, contentItems, currentScene, setCurrentScene, setSelectedVideoId } = useAppStore();
  const [failedVideos, setFailedVideos] = useState<Set<number>>(new Set());

  const selectedVideo = contentItems.find(c => c.id === selectedVideoId);

  if (!selectedVideo) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center p-6 backdrop-blur-sm"
      >
        <div className="max-w-6xl w-full aspect-video bg-[#050505] border border-[#222] relative flex flex-col overflow-hidden shadow-2xl">
          <button 
            onClick={() => setSelectedVideoId(null)}
            className="absolute top-4 right-4 z-10 p-2 bg-black/50 text-white hover:bg-white hover:text-black transition-all font-mono text-xs"
          >
            CLOSE [ESC]
          </button>

          <div className="flex-1 relative overflow-hidden group bg-black">
            <div className="absolute inset-0 flex items-center justify-center">
              <AnimatePresence mode="wait">
                {selectedVideo.videoStoryboard && selectedVideo.videoStoryboard[currentScene] ? (
                  <motion.div
                    key={`scene-container-${currentScene}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative w-full h-full"
                  >
                    {selectedVideo.videoStoryboard[currentScene].videoUrl && !failedVideos.has(currentScene) ? (
                      <video 
                        key={`video-${currentScene}-${selectedVideo.videoStoryboard[currentScene].videoUrl}`}
                        src={selectedVideo.videoStoryboard[currentScene].videoUrl}
                        autoPlay
                        muted
                        playsInline
                        loop
                        onError={() => {
                          setFailedVideos(prev => new Set(prev).add(currentScene));
                        }}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <motion.img 
                        key={`img-${currentScene}-${selectedVideo.videoStoryboard[currentScene].imageUrl}`}
                        initial={{ scale: 1.25, x: -20, y: -10 }}
                        animate={{ scale: 1, x: 0, y: 0 }}
                        transition={{ duration: 12, ease: "easeInOut" }}
                        src={selectedVideo.videoStoryboard[currentScene].imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1280"} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40" />
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-4 text-[#444]">
                    <Loader2 className="w-12 h-12 animate-spin" />
                    <p className="font-mono text-xs uppercase tracking-widest">Menyiapkan Visual AI...</p>
                  </div>
                )}
              </AnimatePresence>
              
              <div className="absolute bottom-12 right-8 z-40 flex items-center gap-4">
                <button 
                  onClick={() => setCurrentScene(Math.max(0, currentScene - 1))}
                  className="p-2 border border-white/20 text-white/50 hover:text-white hover:border-white transition-all bg-black/40"
                >
                  PREV
                </button>
                <button 
                  onClick={() => setCurrentScene((currentScene + 1) % (selectedVideo.videoStoryboard?.length || 1))}
                  className="p-2 border border-white/20 text-white/50 hover:text-white hover:border-white transition-all bg-black/40"
                >
                  NEXT
                </button>
              </div>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center pointer-events-none z-20">
                <AnimatePresence mode="wait">
                  {selectedVideo.videoStoryboard && selectedVideo.videoStoryboard[currentScene] && (
                    <motion.div
                      key={`text-${currentScene}`}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-6 max-w-4xl"
                    >
                      <div className="inline-block px-4 py-1 bg-white text-black font-mono text-[11px] font-bold uppercase tracking-[0.3em] mb-4 shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)]">
                        SCENE {selectedVideo.videoStoryboard[currentScene].scene} / {selectedVideo.videoStoryboard.length}
                      </div>
                      
                      <p className="text-xl md:text-3xl text-white font-mono tracking-tight font-bold bg-black/40 backdrop-blur-md px-10 py-6 mt-8 shadow-2xl uppercase max-w-4xl border border-white/10">
                        <span>
                          {selectedVideo.videoStoryboard[currentScene].audio.replace(/^(Scene|Scena|Bagian|Pemandangan|Narator|Narrator|Visual|Prompt|Scene\s*\d+)\s*[:\s-]+/i, "").trim()}
                        </span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 z-30">
                <motion.div 
                  key={`progress-${currentScene}`}
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: SCENE_DURATION / 1000, ease: "linear" }}
                  className="h-full bg-white shadow-[0_0_10px_white]"
                />
              </div>
            </div>

            <div className="absolute top-8 left-8 z-[25] pointer-events-none">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_red]" />
                <span className="text-white font-mono text-[10px] uppercase tracking-widest font-bold">REC // AI_NEURAL_STREAM</span>
              </div>
              <p className="text-[#666] font-mono text-[9px] mt-1">BITRATE: 4.0 MBPS // 1080P HD</p>
            </div>
          </div>
          
          <div className="p-4 bg-black border-t border-[#1A1A1A] flex justify-between items-center text-[10px] font-mono uppercase tracking-[0.3em]">
            <div className="flex gap-6">
              <span className="text-white">Format: HD (MP4/WebM)</span>
              <span className="text-[#444]">Encoder: AI-FACTORY-RENDER-NODE-01</span>
            </div>
            <div className="text-white">Status: Preview Mode</div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
