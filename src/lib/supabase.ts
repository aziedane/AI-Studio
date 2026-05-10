import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!supabaseInstance) {
    let supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn("[SUPABASE] Credentials missing. App will operate in limited mode.");
      throw new Error("Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the Settings menu.");
    }

    // Ensure protocol
    if (!supabaseUrl.startsWith('http')) {
      supabaseUrl = `https://${supabaseUrl}`;
    }
    
    // Remote trailing slash
    supabaseUrl = supabaseUrl.replace(/\/$/, '');

    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        }
      });
      console.log("[SUPABASE] Client Initialized Successfully");
    } catch (e) {
      console.error("[SUPABASE] Failed to create client:", e);
      throw e;
    }
  }
  return supabaseInstance;
}
