import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { BrandAsset } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBrandAssetDto } from './brand-assets.dto';
import {
  BRAND_ASSETS_UPLOAD_DIR,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  MIME_TO_EXT,
} from './brand-assets.types';

@Injectable()
export class BrandAssetsService {
  private readonly logger = new Logger(BrandAssetsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    dto: CreateBrandAssetDto,
    file: Express.Multer.File,
  ): Promise<BrandAsset> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      );
    }

    let width = 0;
    let height = 0;

    if (file.mimetype !== 'image/svg+xml') {
      const metadata = await sharp(file.buffer).metadata();
      width = metadata.width ?? 0;
      height = metadata.height ?? 0;
    }

    const ext = MIME_TO_EXT[file.mimetype] ?? 'bin';

    const brandAsset = await this.prisma.brandAsset.create({
      data: {
        name: dto.name,
        type: dto.type,
        filePath: '',
        mimeType: file.mimetype,
        width,
        height,
      },
    });

    const filePath = path.join(
      BRAND_ASSETS_UPLOAD_DIR,
      `${brandAsset.id}.${ext}`,
    );
    fs.mkdirSync(BRAND_ASSETS_UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(filePath, file.buffer);

    const updated = await this.prisma.brandAsset.update({
      where: { id: brandAsset.id },
      data: { filePath },
    });

    this.logger.log(`Brand asset ${brandAsset.id} created: ${dto.name}`);
    return updated;
  }

  async findAll(): Promise<BrandAsset[]> {
    return this.prisma.brandAsset.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<BrandAsset> {
    const brandAsset = await this.prisma.brandAsset.findUnique({
      where: { id },
    });

    if (!brandAsset) {
      throw new NotFoundException('Brand asset not found');
    }

    return brandAsset;
  }

  async getImageBuffer(
    id: string,
  ): Promise<{ buffer: Buffer; brandAsset: BrandAsset }> {
    const brandAsset = await this.findOne(id);

    try {
      const buffer = fs.readFileSync(brandAsset.filePath);
      return { buffer, brandAsset };
    } catch {
      throw new NotFoundException('Brand asset image not available');
    }
  }

  async remove(id: string): Promise<void> {
    const brandAsset = await this.findOne(id);

    await this.prisma.brandAsset.delete({ where: { id } });

    if (brandAsset.filePath) {
      try {
        fs.unlinkSync(brandAsset.filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn(
            `Failed to delete file for brand asset ${id}: ${(error as Error).message}`,
          );
        }
      }
    }

    this.logger.log(`Brand asset ${id} deleted`);
  }
}
