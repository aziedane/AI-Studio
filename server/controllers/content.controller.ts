import { Request, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.service.ts';
import logger from '../utils/logger.ts';

export class ContentController {
  public static async deleteItem(req: Request, res: Response) {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: "ID required" });
    }

    try {
      logger.info(`[SERVER] Deleting content item: ${id}`);
      await supabaseAdmin.deleteContentItem(id);
      res.json({ success: true });
    } catch (err: any) {
      logger.error(`[SERVER] Failed to delete content item ${id}: ${err.message}`);
      res.status(500).json({ error: "Failed to delete item", detail: err.message });
    }
  }
}
