# Pabrik Konten AI (Neural Cinema Engine)

Pabrik Konten AI adalah platform otonom berbasis kecerdasan buatan yang dirancang untuk mengotomatisasi seluruh siklus hidup pembuatan konten video. Dari penemuan tren hingga rendering akhir, sistem ini menggunakan pipeline canggih untuk menghasilkan konten berkualitas tinggi dengan keterlibatan minimal dari manusia.

## Arsitektur Pipeline Produksi (Neural Cinema Engine)

Sistem ini beroperasi menggunakan pipeline multi-tahap yang terkoordinasi:

1.  **LLM Director**: Merancang naskah dan alur cerita naratif yang disesuaikan dengan tren terkini.
2.  **Scene JSON Parser**: Memvalidasi dan menyusun struktur metadata untuk setiap adegan.
3.  **Prompt Enhancer**: Melakukan rekayasa prompt (prompt engineering) untuk memastikan fidelitas visual yang tinggi.
4.  **Flux/SDXL Generator**: Merender aset visual ultra-HD (8K) untuk setiap adegan.
5.  **AnimateDiff Motion**: Menyuntikkan gerakan sinematik ke dalam gambar statis.
6.  **Neural Voice Generator**: Mensintesis narasi suara (voiceover) menggunakan teknologi suara neural yang natural.
7.  **Validator**: Melakukan pengecekan kualitas otomatis terhadap koherensi visual dan audio.
8.  **Remotion Composer**: Merakit lapisan visual, audio, dan subtitle ke dalam timeline video.
9.  **FFmpeg Final Render**: Melakukan encoding video 4K dengan koreksi warna LUT.

## Fitur Utama

-   **Otonomi Penuh**: Berjalan secara otomatis mulai dari riset tren hingga video siap tayang.
-   **Dashboard Agen**: Pantau kinerja agen AI (Trend Hunter, Visual Producer, Thumbnail Artist, dan Publisher) secara real-time.
-   **Visual Dinamis**: Kombinasi antara klip video nyata dan aset yang dihasilkan AI.
-   **Optimasi SEO**: Menghasilkan judul, deskripsi, dan tag otomatis yang dioptimalkan untuk algoritma YouTube.

## Cara Menjalankan

1.  Install dependensi:
    ```bash
    npm install
    ```
2.  Jalankan server pengembangan:
    ```bash
    npm run dev
    ```
3.  Buka browser di `http://localhost:3000`.

## Prasyarat

-   Node.js 18+
-   API Key (Gemini API) yang dikonfigurasi melalui variabel lingkungan.

---
© 2026 Pabrik Konten AI Team. Lisensi MIT.
