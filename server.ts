import express from "express";
import cors from "cors";
import path from "path";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { exec } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import ffmpeg from "fluent-ffmpeg";
import multer from "multer";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { google } from "googleapis";
import cookieParser from "cookie-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upload = multer({ dest: 'uploads/' });

// Ensure upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.set('trust proxy', true);
  app.use(cookieParser());
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  const appUrl = process.env.APP_URL?.replace(/\/$/, '');
  console.log("[SYSTEM] App Base URL configured as:", appUrl || "(Not set, using auto-detection)");
  
  const getRedirectUri = (req: express.Request) => {
    if (appUrl) return `${appUrl}/auth/callback`;
    
    // Fallback: detect from request with proxy awareness
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    
    // Force https for cloud environment URIs
    const finalProtocol = (host?.includes('asia-east1.run.app') || host?.includes('ais-dev')) ? 'https' : protocol;
    
    return `${finalProtocol}://${host}/auth/callback`;
  };

  const getOAuth2Client = (req?: express.Request) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
    const rUri = req ? getRedirectUri(req) : (appUrl ? `${appUrl}/auth/callback` : undefined);

    if (!clientId) {
      console.warn("[OAUTH] Warning: GOOGLE_CLIENT_ID is missing or empty.");
    }

    return new google.auth.OAuth2(clientId, clientSecret, rUri);
  };

  // --- AUTH CALLBACK FIRST (Avoid 404s) ---
  app.get(["/auth/callback", "/auth/callback/"], async (req, res) => {
    console.log("[OAUTH] Callback received. URL:", req.url);
    const { code, error } = req.query;
    
    if (error) {
      console.error("[OAUTH] Google returned an error:", error);
      return res.status(500).send(`Auth failed from Google: ${error}`);
    }

    if (!code) {
      console.warn("[OAUTH] Callback missing code. Query:", req.query);
      return res.status(400).send("No auth code received from Google.");
    }

    try {
      const client = getOAuth2Client(req);
      const { tokens } = await client.getToken(code as string);
      console.log("[OAUTH] Successfully exchanged code for tokens.");
      
      res.cookie('yt_tokens', JSON.stringify(tokens), {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      res.send(`
        <html>
          <body style="background: #000; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
            <div style="text-align: center; padding: 20px;">
              <h2 style="color: #22c55e;">YouTube Connected!</h2>
              <p>You can close this window now.</p>
              <button onclick="window.close()" style="margin-top: 10px; padding: 8px 16px; background: #22c55e; color: #000; border: none; border-radius: 4px; cursor: pointer;">Close</button>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'YOUTUBE_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1500);
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (err: any) {
      console.error("[OAUTH] Callback Token Exchange Error:", err.message);
      res.status(500).send("Auth failed during token exchange: " + err.message);
    }
  });

  // --- API ROUTES ---
  console.log("[SYSTEM] Checking for FFmpeg presence...");
  exec("ffmpeg -version", (err, stdout) => {
    if (err) {
      console.warn("[SYSTEM] WARNING: FFmpeg not detected in PATH. Video mastering may fail.");
    } else {
      console.log("[SYSTEM] FFmpeg detected:", stdout.split('\n')[0]);
    }
  });

  // 1. Pro Stock API (Pexels Proxy)
  app.get("/api/stock/video", async (req, res) => {
    const { query } = req.query;
    const apiKey = (process.env.PEXELS_API_KEY || "").trim();

    if (!apiKey) {
      console.warn("[STOCK] PEXELS_API_KEY missing. Falling back to empty response.");
      return res.json({ error: "PEXELS_API_KEY missing", fallback: true });
    }

    try {
      console.log(`[STOCK] Searching Pexels for: "${query}"`);
      const response = await axios.get(`https://api.pexels.com/videos/search?query=${query}&per_page=5`, {
        headers: { Authorization: apiKey },
        timeout: 10000
      });
      
      const videos = response.data.videos;
      if (videos && videos.length > 0) {
        // Pick a random video from the top results to avoid repetition
        const video = videos[Math.floor(Math.random() * Math.min(videos.length, 3))];
        const file = video.video_files.find((f: any) => f.quality === 'hd' || f.quality === 'sd') || video.video_files[0];
        console.log(`[STOCK] Found video (${videos.length} results): ${file.link.substring(0, 50)}...`);
        return res.json({ url: file.link });
      }
      console.log(`[STOCK] No video found for: "${query}"`);
      res.json({ error: "No video found" });
    } catch (err: any) {
      console.error(`[STOCK] Pexels API failed: ${err.message}`);
      res.status(500).json({ error: "Pexels API failed" });
    }
  });

    // 2. Production TTS (Edge Neural - Free & Unlimited)
    app.post("/api/tts", async (req, res) => {
      const { text, voice = "id-ID-ArdiNeural", emotion = "neutral" } = req.body;
      
      const ttsHandler = new MsEdgeTTS();
      
      // Map emotion to Edge TTS rate/pitch
      let pitch = "+0Hz";
      let rate = "+0%";

      const e = emotion.toLowerCase();
      if (e.includes('excited') || e.includes('energetic')) {
        pitch = "+2Hz";
        rate = "+15%";
      } else if (e.includes('sad') || e.includes('calm') || e.includes('mysterious')) {
        pitch = "-2Hz";
        rate = "-10%";
      } else if (e.includes('dramatic') || e.includes('epic')) {
        pitch = "-1Hz";
        rate = "-5%";
      }

      try {
        console.log(`[AUDIO] Using Edge Neural (Free) for [${emotion}]: "${text.substring(0, 30)}..."`);
        
        await ttsHandler.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const { audioStream } = ttsHandler.toStream(text, { pitch, rate });
        
        // Convert stream to buffer
        const chunks: Buffer[] = [];
        for await (const chunk of audioStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const audioBuffer = Buffer.concat(chunks);
        console.log(`[AUDIO] TTS Generated. Buffer size: ${audioBuffer.length} bytes`);
        
        const base64Audio = audioBuffer.toString('base64');
        return res.json({ 
          audio: `data:audio/mpeg;base64,${base64Audio}`, 
          provider: "ms-edge",
          voice
        });

      } catch (err: any) {
        console.warn(`[AUDIO] Edge Neural Failed. Attempting OpenAI Fallback if key exists.`, err.message);
        
        // Fallback to OpenAI if key provided
        const openAIKey = process.env.OPENAI_API_KEY;
        if (openAIKey) {
          try {
            console.log(`[AUDIO] Falling back to OpenAI Neural...`);
            const response = await axios.post(
              "https://api.openai.com/v1/audio/speech",
              {
                model: "tts-1",
                input: text,
                voice: "alloy",
              },
              {
                headers: { Authorization: `Bearer ${openAIKey}` },
                responseType: "arraybuffer",
              }
            );
            const base64Audio = Buffer.from(response.data).toString('base64');
            return res.json({ audio: `data:audio/mpeg;base64,${base64Audio}`, provider: "openai" });
          } catch (oaErr: any) {
            console.error("[AUDIO] OpenAI Fallback Also Failed:", oaErr.message);
          }
        }
        
        res.status(500).json({ error: "Voice Generation Failed - All providers exhausted." });
      }
    });

  // 3. Backend FFmpeg Full Rendering (Storyboard to MP4)
  app.post("/api/render-backend", async (req, res) => {
    const { contentId, storyboard, title } = req.body;
    if (!storyboard || !Array.isArray(storyboard)) {
      return res.status(400).json({ error: "Invalid storyboard data" });
    }

    const workDir = path.join(uploadDir, `render_${contentId}_${Date.now()}`);
    if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

    console.log(`[RENDER-SERVER] Starting full render for: ${title} (${contentId})`);
    
    try {
      // Step 1: Prepare work directories and download assets in parallel
      const sceneFiles: string[] = [];
      const renderTasks = storyboard.map(async (scene: any, i: number) => {
        const sceneId = `scene_${i.toString().padStart(3, '0')}`;
        const imgPath = path.join(workDir, `${sceneId}_img`);
        const audioPath = path.join(workDir, `${sceneId}_audio.mp3`);
        const sceneOutputPath = path.join(workDir, `${sceneId}_out.mp4`);

        // Download assets in parallel
        console.log(`[RENDER-SERVER] Downloading assets for ${sceneId}...`);
        
        const imageUrl = scene.imageUrl || `https://placehold.co/1280x720/000000/FFFFFF?text=SCENE+${i+1}`;
        const imagePromise = axios.get(imageUrl, { responseType: 'arraybuffer' }).then(res => {
          fs.writeFileSync(imgPath, Buffer.from(res.data));
        });

        const audioPromise = scene.voiceUrl 
          ? axios.get(scene.voiceUrl, { responseType: 'arraybuffer' }).then(res => {
              fs.writeFileSync(audioPath, Buffer.from(res.data));
            })
          : new Promise((resolve, reject) => {
              exec(`ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t ${scene.duration || 5} -q:a 9 -acodec libmp3lame ${audioPath}`, (err) => {
                if (err) reject(err); else resolve(true);
              });
            });

        await Promise.all([imagePromise, audioPromise]);
        return { imgPath, audioPath, sceneOutputPath, scene, i };
      });

      const preparedScenes = await Promise.all(renderTasks);

      // Step 2: Render individual scene MP4s in batches of 3 to speed up but avoid crashing
      const batchSize = 3;
      for (let i = 0; i < preparedScenes.length; i += batchSize) {
        const batch = preparedScenes.slice(i, i + batchSize);
        await Promise.all(batch.map(async (s) => {
          const { imgPath, audioPath, sceneOutputPath, scene, i: idx } = s;
          console.log(`[RENDER-SERVER] Rendering ${sceneOutputPath}...`);
          
          const subtitleText = scene.audio 
            ? scene.audio
                .replace(/'/g, "'\\''") // Escape single quotes for shell
                .replace(/:/g, "\\:")   // Escape colons for drawtext
                .replace(/,/g, "\\,")   // Escape commas for drawtext
            : "";
          
          await new Promise((resolve, reject) => {
            ffmpeg()
              .input(imgPath)
              .loop(scene.duration || 5)
              .input(audioPath)
              .videoFilters([
                { filter: 'scale', options: '1280:720:force_original_aspect_ratio=decrease' },
                { filter: 'pad', options: '1280:720:(ow-iw)/2:(oh-ih)/2' },
                { filter: 'format', options: 'yuv420p' },
                {
                  filter: 'drawtext',
                  options: {
                    text: subtitleText,
                    fontcolor: 'white',
                    fontsize: 28,
                    box: 1,
                    boxcolor: 'black@0.6',
                    boxborderw: 10,
                    x: '(w-text_w)/2',
                    y: 'h-100',
                    fix_bounds: 1
                  }
                }
              ])
              .outputOptions([
                '-c:v libx264',
                '-preset ultrafast', // Use ultrafast for intermediate scenes
                '-tune stillimage',
                '-pix_fmt yuv420p',
                '-shortest',
                '-r 30'
              ])
              .on('end', () => resolve(true))
              .on('error', (err) => {
                console.error(`[FFMPEG-SCENE] Error rendering scene ${idx}:`, err);
                reject(err);
              })
              .save(sceneOutputPath);
          });
          sceneFiles[idx] = sceneOutputPath;
        }));
      }

      // Step 3: Concat all scenes
      const concatListPath = path.join(workDir, 'list.txt');
      const listContent = sceneFiles.map(f => `file '${path.basename(f)}'`).join('\n');
      fs.writeFileSync(concatListPath, listContent);

      const finalOutputPath = path.join(uploadDir, `${contentId}.mp4`);
      
      console.log(`[RENDER-SERVER] Concatenating ${sceneFiles.length} scenes...`);
      
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(concatListPath)
          .inputOptions(['-f concat', '-safe 0'])
          .outputOptions(['-c copy'])
          .on('end', () => resolve(true))
          .on('error', (err) => reject(err))
          .save(finalOutputPath);
      });

      console.log(`[RENDER-SERVER] Render SUCCESS: ${finalOutputPath}`);
      
      res.json({ 
        success: true, 
        downloadUrl: `/api/download/${contentId}.mp4` 
      });

      // Async cleanup (don't wait for response)
      setTimeout(() => {
        try {
          fs.rmSync(workDir, { recursive: true, force: true });
        } catch(e) {}
      }, 30000);

    } catch (err: any) {
      console.error("[RENDER-SERVER] FATAL ERROR:", err.message);
      res.status(500).json({ error: "Balkend Rendering Gagal", details: err.message });
      if (fs.existsSync(workDir)) fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  // 4. Backend FFmpeg Export (Transcoding WebM to Production MP4 H.264)
  app.post("/api/export", upload.single('video'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No video file provided" });
    }

    const { contentId } = req.body;
    const inputPath = req.file.path;
    const filename = contentId ? `${contentId}.mp4` : `${req.file.filename}.mp4`;
    const outputPath = path.join('uploads', filename);

    console.log(`[BACKEND] Starting Mastering for ${contentId || 'unknown'}: H.264 Conversion...`);

    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-profile:v high',
        '-level:v 4.1',
        '-preset fast',
        '-crf 20',
        '-c:a aac',
        '-b:a 128k',
        '-ar 44100',
        '-movflags +faststart',
        '-pix_fmt yuv420p',
        '-vf scale=trunc(iw/2)*2:trunc(ih/2)*2'
      ])
      .toFormat('mp4')
      .on('end', () => {
        console.log('[BACKEND] Mastering Complete');
        res.json({ 
          success: true, 
          downloadUrl: `/api/download/${path.basename(outputPath)}` 
        });
        // Cleanup input
        fs.unlinkSync(inputPath);
      })
      .on('error', (err) => {
        console.error('[BACKEND] FFmpeg Error:', err.message);
        res.status(500).json({ error: "FFmpeg Conversion Failed", details: err.message });
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      })
      .save(outputPath);
  });

  // 4. Download Route
  app.get("/api/download/:filename", (req, res) => {
    const filePath = path.join(process.cwd(), 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
      res.download(filePath, 'production_master.mp4');
    } else {
      res.status(404).json({ error: "File not found" });
    }
  });

  // 5. Media Proxy (Bypass CORS for Canvas Rendering and handle rate limiting)
  app.get(["/api/proxy/image", "/api/proxy/video", "/api/proxy/audio"], async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL required");
    
    try {
      const response = await axios({
        method: 'get',
        url: url as string,
        responseType: 'arraybuffer',
        timeout: 60000, // Increased to 60s for high-res assets or slow generators
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': req.path.includes('video') ? 'video/*' : (req.path.includes('audio') ? 'audio/mpeg' : 'image/*')
        }
      });
      
      const contentType = String(response.headers['content-type'] || (req.path.includes('video') ? 'video/mp4' : (req.path.includes('audio') ? 'audio/mpeg' : 'image/jpeg')));
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(response.data);
    } catch (err: any) {
      if (err.response?.status === 429) {
        console.warn("[PROXY] Rate limited by external source:", url);
        return res.status(429).send("Too many requests to source");
      }
      console.error("[PROXY] Error:", err.message, "URL:", url);
      res.status(err.response?.status || 500).send(err.message || "Proxying failed");
    }
  });

  function addLog(msg: string) {
    console.log(new Date().toISOString(), msg);
  }

  // 4. YouTube Auth & Status
  app.get("/api/auth/status", async (req, res) => {
    const tokens = req.cookies.yt_tokens;
    if (!tokens) {
      return res.json({ connected: false });
    }

    try {
      const client = getOAuth2Client(req);
      client.setCredentials(JSON.parse(tokens));
      const youtube = google.youtube({ version: "v3", auth: client });
      const response = await youtube.channels.list({
        mine: true,
        part: ["snippet"]
      });
      
      const channel = response.data.items?.[0];
      res.json({ 
        connected: true, 
        channelName: channel?.snippet?.title || "Unknown Channel",
        thumbnail: channel?.snippet?.thumbnails?.default?.url
      });
    } catch (err) {
      res.json({ connected: false });
    }
  });

  app.get("/api/auth/youtube", (req, res) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();

    if (!clientId || !clientSecret) {
      console.error("[OAUTH] Missing credentials. ID length:", clientId.length, "Secret length:", clientSecret.length);
      return res.status(500).json({ 
        success: false, 
        error: `Server configuration missing: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET. Please check App Settings / Secrets. (Found ID length: ${clientId.length})` 
      });
    }

    if (!clientId.includes(".apps.googleusercontent.com")) {
      console.warn("[OAUTH] WARNING: GOOGLE_CLIENT_ID might be incomplete. It usually ends with .apps.googleusercontent.com");
    }

    const client = getOAuth2Client(req);
    const rUri = getRedirectUri(req);

    const scopes = [
      "https://www.googleapis.com/auth/youtube.upload", 
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/userinfo.profile"
    ];
    
    try {
      // Force internal state just in case
      (client as any)._clientId = clientId;
      (client as any)._clientSecret = clientSecret;
      (client as any).redirectUri = rUri;

      const url = client.generateAuthUrl({
        access_type: "offline",
        scope: scopes,
        prompt: "consent",
        include_granted_scopes: true,
        redirect_uri: rUri
      });
      
      console.log("[OAUTH] Success: Generated Auth URL.");
      console.log("[OAUTH] Full URL (Masked ID):", url.replace(clientId, "REDACTED_ID"));
      console.log("[OAUTH] Final Redirect URI for Google Console:", rUri);
      
      if (!url.includes("client_id=")) {
        console.error("[OAUTH] CRITICAL: Generated URL is MISSING client_id parameter. Internal state:", {
          hasClientId: !!(client as any)._clientId,
          clientIdLen: (client as any)._clientId?.length
        });
      }
      
      res.json({ url, debug: { clientIdSnippet: clientId.substring(0, 5), rUri } });
    } catch (err: any) {
      console.error("[OAUTH] generateAuthUrl Error:", err.message);
      res.status(500).json({ success: false, error: "Failed to generate login URL: " + err.message });
    }
  });

  app.post("/api/youtube/upload", async (req, res) => {
    const { title, description, contentId } = req.body;
    const tokens = req.cookies.yt_tokens;

    if (!tokens) {
      return res.status(401).json({ success: false, error: "Not connected to YouTube" });
    }

    if (!title || !description) {
      return res.status(400).json({ success: false, error: "Title and description are required" });
    }

    const uploadDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, `${contentId}.mp4`);
    
    if (!fs.existsSync(filePath)) {
      // Fallback: look for any .mp4 file if contentId mapping is missing
      const files = fs.readdirSync(uploadDir);
      const targetFile = files.find(f => f.endsWith('.mp4'));
      if (!targetFile) {
        return res.status(404).json({ success: false, error: "Master video file not found for upload" });
      }
      // Use fallback
      return res.status(404).json({ success: false, error: "Specific master file for this contentId not found. Expected: " + contentId + ".mp4" });
    }

    try {
      const client = getOAuth2Client(req);
      client.setCredentials(JSON.parse(tokens));
      const youtube = google.youtube({ version: "v3", auth: client });

      console.log(`[YOUTUBE] Uploading real video: ${contentId}.mp4`);

      const response = await youtube.videos.insert({
        part: ["snippet", "status"],
        requestBody: {
          snippet: {
            title,
            description,
            tags: ["AI", "Automation", "Trending"],
            categoryId: "28" // Science & Technology
          },
          status: {
            privacyStatus: "unlisted" // Start as unlisted for safety
          }
        },
        media: {
          body: fs.createReadStream(filePath)
        }
      });

      console.log(`[YOUTUBE] Upload successful. ID: ${response.data.id}`);

      res.json({ 
        success: true, 
        message: "Successfully uploaded to YouTube",
        videoId: response.data.id,
        publishedAt: response.data.snippet?.publishedAt || new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[YOUTUBE] Real Upload Error:", err.message);
      res.status(500).json({ success: false, error: "YouTube API Error: " + err.message });
    }
  });

  // Catch-all for unknown API routes BEFORE Vite middleware
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API Route ${req.path} not found` });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PRODUCTION ENGINE] Server running on http://localhost:${PORT}`);
    console.log(`[SYSTEM] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
