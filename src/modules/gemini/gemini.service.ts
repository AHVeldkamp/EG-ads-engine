import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly ai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.get<string>('GEMINI_API_KEY'),
    });
  }

  async generateImage(prompt: string, model: string): Promise<Buffer> {
    this.logger.log(
      `Generating image with model ${model}, prompt length: ${prompt.length}`,
    );

    try {
      const response = await this.ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });

      return this.extractImageFromResponse(response);
    } catch (error) {
      this.logger.warn(
        `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  async editImage(
    imageBuffer: Buffer,
    editPrompt: string,
    model: string,
  ): Promise<Buffer> {
    this.logger.log(
      `Editing image with model ${model}, prompt length: ${editPrompt.length}`,
    );

    try {
      const base64Image = imageBuffer.toString('base64');

      const chat = this.ai.chats.create({
        model,
        config: { responseModalities: ['TEXT', 'IMAGE'] },
      });

      const response = await chat.sendMessage({
        message: [
          { inlineData: { data: base64Image, mimeType: 'image/png' } },
          { text: editPrompt },
        ],
      });

      return this.extractImageFromResponse(response);
    } catch (error) {
      this.logger.warn(
        `Image editing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private extractImageFromResponse(response: unknown): Buffer {
    const resp = response as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { data: string; mimeType: string };
          }>;
        };
      }>;
    };

    const parts = resp?.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error('No content parts in Gemini response');
    }

    for (const part of parts) {
      if (part.inlineData) {
        return Buffer.from(part.inlineData.data, 'base64');
      }
    }

    throw new Error('No image data found in Gemini response');
  }
}
