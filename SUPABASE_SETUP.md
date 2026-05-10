# Panduan Setup Supabase & Google OAuth

## 1. Setup Database (SQL Editor)
Salalin dan jalankan script ini di **SQL Editor** Supabase Anda untuk membuat tabel yang dibutuhkan dengan Row Level Security (RLS) yang aman:

```sql
-- 1. Tabel Trends
CREATE TABLE IF NOT EXISTS trends (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    topic TEXT NOT NULL,
    viral_score NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- 2. Tabel Content Items
CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    trend_id TEXT,
    title TEXT NOT NULL,
    script TEXT,
    thumbnail_url TEXT,
    video_url TEXT,
    video_storyboard JSONB,
    status TEXT DEFAULT 'DISCOVERY',
    progress NUMERIC DEFAULT 0,
    download_url TEXT,
    published_url TEXT,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tambahkan kolom updated_at jika belum ada
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trends' AND column_name='updated_at') THEN
        ALTER TABLE trends ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='content_items' AND column_name='updated_at') THEN
        ALTER TABLE content_items ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Aktifkan RLS (Aman jika sudah aktif)
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- 3. Kebijakan Keamanan (Hapus dulu jika ada lalu buat baru agar tidak error)
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own trends" ON trends;
    CREATE POLICY "Users can manage their own trends" ON trends
        FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "Users can manage their own content" ON content_items;
    CREATE POLICY "Users can manage their own content" ON content_items
        FOR ALL USING (auth.uid() = user_id);
END $$;

-- 4. Aktifkan Realtime untuk Tabel (Penting!)
-- Supabase memerlukan tabel ditambahkan ke publication 'supabase_realtime' agar perubahan bisa disiarkan.
DO $$
BEGIN
    -- Buat publikasi jika belum ada
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- Tambahkan tabel ke publikasi (Aman jika sudah ada)
ALTER PUBLICATION supabase_realtime ADD TABLE trends;
ALTER PUBLICATION supabase_realtime ADD TABLE content_items;
```

## 2. Hubungkan Google OAuth & URL Pengalihan
Agar "Tombol Masuk" berfungsi dan tidak dialihkan ke localhost:

1.  **Supabase Dashboard > Authentication > URL Configuration**:
    *   **Site URL**: Ubah menjadi URL aplikasi Anda (contoh: `https://ais-dev-cylpbwj5za6jcmm2s764kh-214525740717.asia-east1.run.app`)
    *   **Redirect URIs**: Tambahkan URL yang sama jika belum ada.
2.  **Google Cloud Console**:
    *   Pilih Project Anda > **APIs & Services > Credentials**.
    *   Edit **OAuth 2.0 Client ID**.
    *   Pada **Authorized redirect URIs**, pastikan URL callback Supabase sudah benar:
        `https://llgymjeklbrlodhzobrd.supabase.co/auth/v1/callback`
3.  **Supabase > Authentication > Providers > Google**:
    *   Pastikan **Client ID** dan **Client Secret** sudah benar dan statusnya **Enabled**.

## 3. Environment Variables
Pastikan variabel ini sudah diisi di menu **Settings** AI Studio App Anda:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
