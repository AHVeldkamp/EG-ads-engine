import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import sharp from 'sharp';

export type BrandAssetPosition =
  | 'top-left'
  | 'top-right'
  | 'top-center'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center';

@Injectable()
export class ImageCompositeService {
  private readonly logger = new Logger(ImageCompositeService.name);

  async compositeOverlay(
    baseImageBuffer: Buffer,
    overlayImageBuffer: Buffer,
    position: BrandAssetPosition,
    scalePercent: number,
  ): Promise<Buffer> {
    try {
      const baseMetadata = await sharp(baseImageBuffer).metadata();
      const baseWidth = baseMetadata.width ?? 1024;
      const baseHeight = baseMetadata.height ?? 1024;

      const overlayWidth = Math.round(baseWidth * (scalePercent / 100));

      const resizedOverlay = await sharp(overlayImageBuffer)
        .resize({ width: overlayWidth, withoutEnlargement: false })
        .png()
        .toBuffer();

      const overlayMetadata = await sharp(resizedOverlay).metadata();
      const overlayHeight = overlayMetadata.height ?? 0;

      const paddingX = Math.round(baseWidth * 0.03);
      const paddingY = Math.round(baseHeight * 0.03);

      const { left, top } = this.calculatePosition(
        baseWidth,
        baseHeight,
        overlayWidth,
        overlayHeight,
        paddingX,
        paddingY,
        position,
      );

      const result = await sharp(baseImageBuffer)
        .composite([
          {
            input: resizedOverlay,
            left,
            top,
          },
        ])
        .png()
        .toBuffer();

      this.logger.log(
        `Composited overlay at ${position} (${scalePercent}% scale)`,
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Image compositing failed: ${message}`);
      throw new UnprocessableEntityException(
        `Image compositing failed: ${message}`,
      );
    }
  }

  private calculatePosition(
    baseWidth: number,
    baseHeight: number,
    overlayWidth: number,
    overlayHeight: number,
    paddingX: number,
    paddingY: number,
    position: BrandAssetPosition,
  ): { left: number; top: number } {
    switch (position) {
      case 'top-left':
        return { left: paddingX, top: paddingY };
      case 'top-center':
        return {
          left: Math.round((baseWidth - overlayWidth) / 2),
          top: paddingY,
        };
      case 'top-right':
        return { left: baseWidth - overlayWidth - paddingX, top: paddingY };
      case 'bottom-left':
        return {
          left: paddingX,
          top: baseHeight - overlayHeight - paddingY,
        };
      case 'bottom-center':
        return {
          left: Math.round((baseWidth - overlayWidth) / 2),
          top: baseHeight - overlayHeight - paddingY,
        };
      case 'bottom-right':
        return {
          left: baseWidth - overlayWidth - paddingX,
          top: baseHeight - overlayHeight - paddingY,
        };
    }
  }
}
