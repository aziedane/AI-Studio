import { Request, Response } from 'express';
import { renderService } from '../services/render.service.ts';
import logger from '../utils/logger.ts';

export class RenderController {
  public static async startRender(req: Request, res: Response) {
    const { contentId, storyboard, title, userId, fullItem } = req.body;
    
    if (!contentId || !storyboard || !title || !userId || !fullItem) {
      return res.status(400).json({ error: "Missing required fields (contentId, storyboard, title, userId, fullItem)" });
    }

    try {
      const jobId = renderService.createJob(contentId, title, storyboard, userId, fullItem);
      logger.info(`Started Render Job: ${jobId} for ${title}`);
      res.json({ success: true, jobId });
    } catch (err: any) {
      logger.error(`Failed to start render: ${err.message}`);
      res.status(500).json({ error: "Failed to start render", detail: err.message });
    }
  }

  public static async getStatus(req: Request, res: Response) {
    const { id } = req.params;
    const job = renderService.getJob(id);
    
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json(job);
  }
}
