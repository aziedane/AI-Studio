import { Request, Response } from 'express';
import { stockService } from '../services/stock.service.ts';

export class StockController {
  public static async search(req: Request, res: Response) {
    const { query } = req.query;
    if (!query) return res.status(400).json({ error: "Query required" });

    try {
      const result = await stockService.searchVideo(query as string);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: "Stock search failed" });
    }
  }
}
