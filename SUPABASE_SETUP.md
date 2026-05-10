# Panduan Setup Supabase & Google OAuth

## 1. Setup Database (SQL Editor)
Salalin dan jalankan script ini di **SQL Editor** Supabase Anda untuk membuat tabel yang dibutuhkan dengan Row Level Security (RLS) yang aman:

```sql
-- Hapus jika ingin reset (Hati-hati: data akan hilang!)
-- DROP TABLE IF EXISTS content_items;
-- DROP TABLE IF EXISTS trends;

-- Tabel Trends
CREATE TABLE IF NOT EXISTS trends (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    topic TEXT NOT NULL,
    viral_score NUMERIC,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Tabel Content Items
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
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Aktifkan RLS
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;

-- Kebijakan Trends: Hanya pemilik yang bisa akses
CREATE POLICY "Users can manage their own trends" ON trends
    FOR ALL USING (auth.uid() = user_id);

-- Kebijakan Content Items: Hanya pemilik yang bisa akses
CREATE POLICY "Users can manage their own content" ON content_items
    FOR ALL USING (auth.uid() = user_id);
```

## 2. Hubungkan Google OAuth
Agar "Tombol Masuk" berfungsi di produksi:

1.  Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2.  Pilih Project Anda, lalu edit **OAuth 2.0 Client ID** yang Anda gunakan.
3.  Pada bagian **Authorized redirect URIs**, tambahkan URL ini:
    `https://llgymjeklbrlodhzobrd.supabase.co/auth/v1/callback`
4.  Simpan perubahan.
5.  Di **Supabase Dashboard**, buka **Authentication > Providers > Google**.
6.  Pastikan **Client ID** dan **Client Secret** sudah benar dan provider sudah dalam status **Enabled**.

## 3. Environment Variables
Pastikan variabel ini sudah diisi di menu **Settings** AI Studio App Anda:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
