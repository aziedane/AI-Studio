import { google } from "googleapis";
import { config } from '../config/index.ts';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.ts';

class YoutubeService {
  public getOAuth2Client(redirectUri?: string) {
    return new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      redirectUri || `${config.google.appUrl}/auth/callback`
    );
  }

  public async uploadVideo(tokens: any, filePath: string, metadata: { title: string, description: string }) {
    const client = this.getOAuth2Client();
    client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: client });

    if (!fs.existsSync(filePath)) {
      throw new Error("File not found for upload: " + filePath);
    }

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: metadata.title,
          description: metadata.description,
          tags: ["AI", "Automation", "Trending"],
          categoryId: "28"
        },
        status: {
          privacyStatus: "unlisted"
        }
      },
      media: {
        body: fs.createReadStream(filePath)
      }
    });

    return response.data;
  }

  public async getChannelStatus(tokens: any) {
    const client = this.getOAuth2Client();
    client.setCredentials(tokens);
    const youtube = google.youtube({ version: "v3", auth: client });
    
    const response = await youtube.channels.list({
      mine: true,
      part: ["snippet"]
    });
    
    const channel = response.data.items?.[0];
    return {
      connected: true,
      channelName: channel?.snippet?.title || "Unknown Channel",
      thumbnail: channel?.snippet?.thumbnails?.default?.url
    };
  }
}

export const youtubeService = new YoutubeService();
