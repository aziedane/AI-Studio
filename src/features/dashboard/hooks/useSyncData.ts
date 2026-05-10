import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { supabaseService } from '../../../services/supabase.service';

export const useSyncData = () => {
  const store = useAppStore();

  useEffect(() => {
    if (!store.user) return;
    
    // Trends are now transient (memory only), no longer syncing from Supabase
    const unsubContent = supabaseService.syncContentItems(store.user.id, store.setContentItems);

    return () => {
      unsubContent();
    };
  }, [store.user]);
};
