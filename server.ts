import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import cookieParser from "cookie-parser";
import { config } from "./server/config/index.ts";
import logger from "./server/utils/logger.ts";
import securityMiddleware from "./server/middleware/security.ts";
import apiRoutes from "./server/routes/api.routes.ts";
import { YoutubeController } from "./server/controllers/youtube.controller.ts";
import { errorHandler } from "./server/middleware/error.middleware.ts";

async function bootstrap() {
  const app = express();

  // Basic Middleware
  app.use(cors());
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  // Security Hardening
  app.use(securityMiddleware);

  // Dedicated Auth Callback (Root level to avoid issues)
  app.get(["/auth/callback", "/auth/callback/"], YoutubeController.handleCallback);

  // API Routes
  app.use("/api", apiRoutes);

  // Global Error Handler
  app.use(errorHandler);

  // Health Check
  app.get("/health", (req, res) => res.json({ status: "UP", timestamp: new Date() }));

  // --- VITE / STATIC SERVING ---
  if (config.env !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    logger.info("[SYSTEM] Vite Middleware Initialized (Development Mode)");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    logger.info("[SYSTEM] Serving Static Files (Production Mode)");
  }

  app.listen(config.port, "0.0.0.0", () => {
    logger.info(`[ENTERPRISE ENGINE] Server running on http://localhost:${config.port}`);
    logger.info(`[SYSTEM] Environment: ${config.env}`);
  });
}

bootstrap().catch(err => {
  console.error("FATAL ERROR DURING BOOTSTRAP:", err);
  process.exit(1);
});
