import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.ts';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`[ERROR] ${req.method} ${req.path}: ${err.message}`);
  
  if (err.stack) {
    logger.debug(err.stack);
  }

  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal Server Error",
    path: req.path,
    timestamp: new Date()
  });
};
