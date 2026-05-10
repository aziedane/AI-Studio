import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Image as ImageIcon, Video, Download, Play, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { supabaseService } from '../../services/supabase.service';
import { ContentPiece } from '../../types';

interface FeedListProps {
  onRender: (id: string) => void;
  onFinalize: (id: string) => void;
  onProduce: (id: string) => void;
  onDownload: (url: string, title: string) => void;
}

export const FeedList: React.FC<FeedListProps> = ({ onRender, onFinalize, onProduce, onDownload }) => {
  const { contentItems, ytConnected, setSelectedVideoId } = useAppStore();

  return (
    <div className="space-y-6">
      {contentItems.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 grayscale">
          <Layers className="w-16 h-16 mb-4" />
          <p className="font-mono text-xs uppercase tracking-widest">Tidak ada siklus produksi aktif</p>
        </div>
      )}
      
      <AnimatePresence>
        {contentItems.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0D0D0D] border border-[#1A1A1A] p-6 group hover:border-[#333] transition-all"
          >
            <div className="flex flex-col md:flex-row gap-6">
              {/* Status/Img */}
              <div className="w-full md:w-48 h-64 md:h-32 bg-[#0A0A0A] relative overflow-hidden shrink-0 border border-[#1A1A1A] group/thumb">
                {item.thumbnailUrl ? (
                  <img src={`https://images.weserv.nl/?url=${encodeURIComponent(item.thumbnailUrl)}&w=600&q=80`} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 group-hover/thumb:scale-110" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-[#111] overflow-hidden">
                    <ImageIcon className="text-[#222] w-8 h-8 mb-2 animate-pulse" />
                    <span className="text-[8px] font-mono text-[#444] uppercase tracking-[0.2em] animate-pulse">Generasi AI Art...</span>
                  </div>
                )}
                <div className={`absolute top-0 right-0 px-2 py-1 text-[8px] font-mono uppercase tracking-widest text-white shadow-xl ${
                  item.status === 'PUBLISHED' ? 'bg-green-600' : 
                  item.status === 'READY' ? 'bg-emerald-500' : 'bg-blue-600'
                }`}>
                  {item.status}
                </div>
              </div>

              {/* Summary */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-mono font-bold text-white uppercase tracking-tight group-hover:text-amber-400 transition-colors">
                      {item.title}
                    </h4>
                    <span className="text-[10px] font-mono text-[#444] uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-xs text-[#666] line-clamp-2 leading-relaxed font-sans mb-4">
                    {item.script}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-end text-[9px] font-mono uppercase tracking-widest text-[#444]">
                    <span>Progres Alur Kerja</span>
                    <span>{item.progress}%</span>
                  </div>
                  <div className="h-[1px] bg-[#1A1A1A] w-full">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${item.progress}%` }}
                      className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.2)]" 
                    />
                  </div>
                </div>

                {item.videoStoryboard && item.videoStoryboard.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-[8px] font-mono text-[#444] uppercase tracking-widest">
                      <Layers className="w-2.5 h-2.5" />
                      <span>Storyboard ({item.videoStoryboard.length} Scenes)</span>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-10 gap-1.5">
                      {item.videoStoryboard.map((scene, idx) => (
                        <div key={idx} className="aspect-video bg-[#0A0A0A] border border-[#1A1A1A] relative group/scene overflow-hidden">
                          {scene.imageUrl ? (
                            <img 
                              src={scene.imageUrl} 
                              alt={`Scene ${idx + 1}`} 
                              className="w-full h-full object-cover transition-all grayscale group-hover/scene:grayscale-0 opacity-40 group-hover/scene:opacity-100" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Loader2 className="w-2 h-2 text-[#222] animate-spin" />
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 py-0.5 bg-black/60 text-[5px] font-mono text-center text-white/40 group-hover/scene:text-white">
                            SCENE {idx + 1}
                          </div>
                          
                          <div className="absolute inset-0 bg-black/95 opacity-0 group-hover/scene:opacity-100 transition-opacity p-2 flex flex-col justify-center">
                            <p className="text-[5px] font-mono text-amber-400 mb-1 uppercase tracking-tighter">{scene.voiceTone}</p>
                            <p className="text-[5px] font-mono text-white line-clamp-3 leading-tight">{scene.audio}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="w-full md:w-32 border-l border-[#1A1A1A] gap-4 pl-6 flex flex-col justify-center">
                <div className="space-y-2">
                  <button 
                    onClick={() => setSelectedVideoId(item.id)}
                    className="w-full py-2 border border-white text-white text-[10px] font-mono uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-3 h-3" /> Putar
                  </button>

                  <button 
                    onClick={() => onProduce(item.id)}
                    className="w-full py-2 bg-zinc-800 text-white/60 text-[10px] font-mono uppercase tracking-widest hover:bg-zinc-700 hover:text-white transition-all flex items-center justify-center gap-2 border border-zinc-700"
                  >
                    Ulang Produksi
                  </button>

                  {item.status === 'PRODUCTION' && (
                    <button 
                      onClick={() => onRender(item.id)}
                      className="w-full py-2 bg-blue-600 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-blue-500 transition-all flex items-center justify-center gap-2 border border-blue-400 group/render relative overflow-hidden"
                    >
                      <Video className="w-3 h-3 group-hover/render:animate-pulse" /> Render Final
                    </button>
                  )}

                  {item.status === 'READY' ? (
                    <div className="space-y-2">
                       {item.downloadUrl && (
                         <button 
                           onClick={() => onDownload(item.downloadUrl!, item.title)}
                           className="w-full py-2 bg-emerald-600 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 border border-emerald-400"
                         >
                           <Download className="w-3 h-3" /> Unduh MP4
                         </button>
                       )}
                       <button 
                         onClick={() => onFinalize(item.id)}
                         className="w-full py-2 bg-zinc-900 border border-zinc-800 text-zinc-500 text-[9px] font-mono uppercase tracking-widest hover:text-white transition-all flex items-center justify-center gap-1"
                       >
                         Siap Publikasi
                       </button>
                    </div>
                  ) : (
                    item.progress > 0 && item.progress < 100 && (
                      <div className="w-full py-2 flex flex-col items-center justify-center gap-1.5 opacity-50">
                        <Loader2 className="w-3 h-3 animate-spin text-zinc-400" />
                        <span className="text-[8px] font-mono uppercase text-zinc-500 tracking-tighter">Sedang Diproses...</span>
                      </div>
                    )
                  )}

                  {item.thumbnailUrl && (
                    <button 
                      onClick={() => onDownload(item.thumbnailUrl!, `${item.title}_thumb`)}
                      className="w-full py-2 bg-zinc-800 text-white/40 text-[9px] font-mono uppercase tracking-widest hover:text-white transition-all flex items-center justify-center gap-2 border border-zinc-700 mt-2"
                    >
                      <Download className="w-2.5 h-2.5" /> Unduh Thumbnail
                    </button>
                  )}

                  {item.status === 'PUBLISHED' && item.publishedUrl && (
                    <a 
                      href={item.publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 bg-red-700 text-white text-[10px] font-mono uppercase tracking-widest hover:bg-red-600 transition-all flex items-center justify-center gap-2"
                    >
                      Buka YouTube
                    </a>
                  )}

                  <button 
                    onClick={() => supabaseService.deleteContentItem(item.id)}
                    className="w-full py-1.5 text-red-500/60 hover:text-red-500 text-[9px] font-mono uppercase tracking-widest transition-all border border-transparent hover:border-red-500/20"
                  >
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
