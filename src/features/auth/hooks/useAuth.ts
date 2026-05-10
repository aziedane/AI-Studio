import { useEffect } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { supabaseService } from '../../../services/supabase.service';

export const useAuth = () => {
  const store = useAppStore();

  useEffect(() => {
    const subscription = supabaseService.onAuthStateChange((user) => {
      store.setUser(user);
      store.setIsAuthLoading(false);
    });

    // Check YouTube status
    const checkYtStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        const data = await res.json();
        store.setYtConnected(data.connected);
      } catch (err) {
        console.error("Failed to check YT status", err);
      }
    };
    checkYtStatus();

    // Listen for OAuth success messages from popups
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'YOUTUBE_AUTH_SUCCESS') {
        store.setYtConnected(true);
        store.addLog("YouTube berhasil terhubung!", "success");
        store.setNotification({ msg: "YouTube Connected!", type: "success" });
      }

      if (event.data?.type === 'SUPABASE_AUTH_SUCCESS') {
        const session = event.data.session;
        if (session?.user) {
          store.setIsAuthLoading(true);
          supabaseService.setSession(session).then(() => {
            supabaseService.getSession().then(freshSession => {
              const finalUser = freshSession?.user || session.user;
              store.setUser(finalUser);
              store.addLog(`Halo, ${finalUser.user_metadata?.full_name || finalUser.email}!`, "success");
              store.setIsAuthLoading(false);
            });
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const login = async () => {
    store.setIsAuthLoading(true);
    try {
      await supabaseService.login();
    } catch (err: any) {
      store.setIsAuthLoading(false);
      store.setNotification({ msg: "Login Gagal: " + err.message, type: "error" });
    }
  };

  const logout = async () => {
    await supabaseService.logout();
    store.setUser(null);
  };

  const connectYoutube = async () => {
    try {
      const response = await fetch('/api/auth/youtube');
      const { url } = await response.json();
      if (url) {
        window.open(url, 'YouTube Auth', 'width=600,height=700');
      }
    } catch (err) {
      store.addLog("Gagal menghubungkan YouTube", "error");
    }
  };

  return { login, logout, connectYoutube };
};
