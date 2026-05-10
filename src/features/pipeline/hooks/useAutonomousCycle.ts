import { useAppStore } from '../../../store/useAppStore';
import { aiService } from '../../../services/ai.service';
import { supabaseService } from '../../../services/supabase.service';
import { useContentPipeline } from '../../../hooks/useContentPipeline';

export const useAutonomousCycle = () => {
  const store = useAppStore();
  const { produceMedia, renderVideo } = useContentPipeline({ current: null } as any); // Dummy for now, actual ref should be passed

  const runCycle = async () => {
    if (!store.user) {
      store.addLog("Harap login terlebih dahulu.", "info");
      return;
    }
    
    if (store.isAutoRunning) return;

    store.setIsAutoRunning(true);
    store.addLog("MENJALANKAN SIKLUS OTOMATIS...", "process");

    try {
      // 1. Scout
      store.updateAgent('scout', { status: 'WORKING', lastAction: 'Scanning Indonesia Trends...' });
      const newTrends = await aiService.scoutTrends(store.selectedNiche || 'Umum');
      if (!newTrends?.length) throw new Error("No trends found");
      store.setTrends(newTrends); // Update local store
      store.updateAgent('scout', { status: 'SUCCESS', lastAction: 'Trends Found' });

      // 2. Architect
      const topTrend = newTrends[0];
      store.updateAgent('architect', { status: 'WORKING', lastAction: 'Drafting Script...' });
      const brief = await aiService.draftScript(topTrend);
      if (!brief) throw new Error("Failed to draft script");
      store.setContentItems([brief as any, ...store.contentItems]); // Update local store
      store.updateAgent('architect', { status: 'SUCCESS', lastAction: 'Script Ready' });

      // 3. Producer
      store.updateAgent('producer', { status: 'WORKING', lastAction: 'Generating Assets...' });
      const producedItem = await produceMedia(brief.id!, brief as any);
      if (!producedItem) throw new Error("Production failed");

      // 4. Publisher (Render)
      store.updateAgent('publisher', { status: 'WORKING', lastAction: 'Starting Render...' });
      await renderVideo(producedItem.id, producedItem as any);
      
      store.addLog("Siklus otomatis selesai!", "success");
    } catch (e: any) {
      store.addLog(`Siklus terhenti: ${e.message}`, "error");
    } finally {
      store.setIsAutoRunning(false);
    }
  };

  return { runCycle };
};
