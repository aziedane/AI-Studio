import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.ts';
import logger from '../utils/logger.ts';

class SupabaseAdminService {
  private supabase;

  constructor() {
    if (!config.supabaseUrl || !config.supabaseKey) {
      logger.warn("[SUPABASE] Missing URL or Key for Admin Service");
    }
    this.supabase = createClient(config.supabaseUrl || '', config.supabaseKey || '');
  }

  public async saveContentItem(item: any, userId: string) {
    const dataToSave = {
      ...this.mapToSupabase(item),
      user_id: userId,
    };
    const { error } = await this.supabase
      .from('content_items')
      .upsert(dataToSave);
    
    if (error) {
      logger.error(`[SUPABASE] Failed to save content item: ${error.message}`);
      throw error;
    }
  }

  public async updateContentItem(id: string, updates: any) {
    const dataToUpdate = this.mapToSupabase(updates);
    const { error } = await this.supabase
      .from('content_items')
      .update(dataToUpdate)
      .eq('id', id);
    
    if (error) {
      logger.error(`[SUPABASE] Failed to update content item ${id}: ${error.message}`);
      throw error;
    }
  }

  public async deleteContentItem(id: string) {
    const { error } = await this.supabase
      .from('content_items')
      .delete()
      .eq('id', id);
    
    if (error) {
      logger.error(`[SUPABASE] Failed to delete content item ${id}: ${error.message}`);
      throw error;
    }
  }

  private mapToSupabase(data: any) {
    const mapped: any = {};
    for (const key in data) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      mapped[snakeKey] = data[key];
    }
    return mapped;
  }

  public async addLog(userId: string, message: string, type: string = 'info') {
    // Optional: persistence of logs in DB
  }
}

export const supabaseAdmin = new SupabaseAdminService();
