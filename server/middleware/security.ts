import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Router } from 'express';

const securityMiddleware = Router();

securityMiddleware.use(helmet({
  contentSecurityPolicy: false, 
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

// Apply rate limiting to critical API routes
securityMiddleware.use('/api/', limiter);

export default securityMiddleware;
