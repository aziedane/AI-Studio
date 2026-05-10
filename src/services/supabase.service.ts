import { getSupabase } from '../lib/supabase';
import { Trend, ContentPiece } from '../types';

export const supabaseService = {
  async login() {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          queryParams: {
            prompt: 'select_account',
          },
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });
      if (error) throw error;
      
      if (data?.url) {
        // Open the auth URL in a popup
        const width = 600, height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(data.url, 'Supabase Auth', `width=${width},height=${height},left=${left},top=${top}`);
        
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          // Fallback to redirect if popup is blocked
          window.location.href = data.url;
        }
      }
      return data;
    } catch (err: any) {
      console.error("Supabase login error:", err);
      throw err;
    }
  },

  async logout() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async setSession(session: any) {
    const supabase = getSupabase();
    const { error } = await supabase.auth.setSession(session);
    if (error) throw error;
  },

  onAuthStateChange(callback: (user: any) => void) {
    try {
      const supabase = getSupabase();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        callback(session?.user || null);
      });
      return subscription;
    } catch (e) {
      console.warn("Supabase auth failed to initialize:", e);
      return { unsubscribe: () => {} };
    }
  },

  syncContentItems(userId: string, callback: (items: ContentPiece[]) => void) {
    try {
      const supabase = getSupabase();
      console.log(`[REALTIME] Memulai sinkronisasi konten untuk user: ${userId}`);

      // Initial fetch
      supabase
        .from('content_items')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (error) {
            if (error.message?.includes('Failed to fetch')) {
               console.error("[REALTIME] Koneksi ke Supabase gagal. Silakan periksa VITE_SUPABASE_URL.");
            } else {
               console.error("[REALTIME] Gagal fetch awal konten:", error);
            }
          } else if (data) {
            callback(this.mapFromSupabase(data) as any);
          }
        });

      // Real-time subscription
      const channel = supabase
        .channel(`content-db-changes-${userId}`)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'content_items', 
            filter: `user_id=eq.${userId}` 
          },
          async (payload) => {
            console.log("[REALTIME] Perubahan konten terdeteksi:", payload.eventType);
            const { data, error } = await supabase
              .from('content_items')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });
            
            if (error) {
              console.error("[REALTIME] Gagal mengambil ulang konten setelah perubahan:", error);
            } else if (data) {
              callback(this.mapFromSupabase(data) as any);
            }
          }
        )
        .subscribe((status) => {
          console.log(`[REALTIME] Status langganan konten: ${status}`);
        });

      return () => {
        console.log("[REALTIME] Memberhentikan sinkronisasi konten");
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn("Supabase syncContentItems failed to initialize:", e);
      return () => {};
    }
  },

  async saveContentItem(item: ContentPiece, userId: string) {
    const supabase = getSupabase();
    const dataToSave = {
      ...this.mapToSupabase(item),
      user_id: userId,
    };
    const { error } = await supabase.from('content_items').upsert(dataToSave);
    if (error) throw error;
  },

  async updateContentItem(id: string, updates: Partial<ContentPiece>) {
    const supabase = getSupabase();
    const dataToUpdate = this.mapToSupabase(updates);
    const { error } = await supabase
      .from('content_items')
      .update(dataToUpdate)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteContentItem(id: string) {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // Helpers to handle field mapping if database uses snake_case
  mapToSupabase(data: any) {
    const mapped: any = {};
    for (const key in data) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      mapped[snakeKey] = data[key];
    }
    return mapped;
  },

  mapFromSupabase(data: any | any[]) {
    if (Array.isArray(data)) return data.map(item => this.mapFromSupabase(item));
    const mapped: any = {};
    for (const key in data) {
      const camelKey = key.replace(/([-_][a-z])/g, group =>
        group.toUpperCase().replace('-', '').replace('_', '')
      );
      mapped[camelKey] = data[key];
    }
    return mapped;
  }
};
