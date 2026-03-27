import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Creative, CreativeStatus, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../gemini/gemini.service';
import { BrandAssetsService } from '../brand-assets/brand-assets.service';
import {
  ImageCompositeService,
  BrandAssetPosition,
} from '../../common/image-composite.service';
import {
  GenerateCreativeDto,
  EditCreativeDto,
  ListCreativesQueryDto,
} from './creatives.dto';
import { UPLOAD_DIR, DEFAULT_MODEL } from './creatives.types';

export interface GenerateWithSeedImageOptions {
  prompt: string;
  tags?: string[];
  seedImage?: Express.Multer.File;
  brandAssetId?: string;
  brandAssetPosition?: string;
  brandAssetScale?: number;
}

@Injectable()
export class CreativesService {
  private readonly logger = new Logger(CreativesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
    private readonly brandAssetsService: BrandAssetsService,
    private readonly imageCompositeService: ImageCompositeService,
  ) {}

  async generate(dto: GenerateCreativeDto): Promise<Creative> {
    const creative = await this.prisma.creative.create({
      data: {
        prompt: dto.prompt,
        tags: dto.tags ?? [],
        status: CreativeStatus.PENDING,
      },
    });

    await this.prisma.creative.update({
      where: { id: creative.id },
      data: { status: CreativeStatus.GENERATING },
    });

    try {
      const imageBuffer = await this.geminiService.generateImage(
        dto.prompt,
        DEFAULT_MODEL,
      );

      fs.mkdirSync(UPLOAD_DIR, { recursive: true });

      const imagePath = path.join(UPLOAD_DIR, `${creative.id}.png`);
      fs.writeFileSync(imagePath, imageBuffer);

      const updated = await this.prisma.creative.update({
        where: { id: creative.id },
        data: {
          imagePath,
          status: CreativeStatus.COMPLETED,
        },
      });

      this.logger.log(`Creative ${creative.id} generated successfully`);
      return updated;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.creative.update({
        where: { id: creative.id },
        data: {
          status: CreativeStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.warn(
        `Creative ${creative.id} generation failed: ${errorMessage}`,
      );
      throw new UnprocessableEntityException(
        `Image generation failed: ${errorMessage}`,
      );
    }
  }

  async generateWithSeedImage(
    options: GenerateWithSeedImageOptions,
  ): Promise<Creative> {
    const creative = await this.prisma.creative.create({
      data: {
        prompt: options.prompt,
        tags: options.tags ?? [],
        status: CreativeStatus.PENDING,
      },
    });

    await this.prisma.creative.update({
      where: { id: creative.id },
      data: { status: CreativeStatus.GENERATING },
    });

    try {
      let imageBuffer: Buffer;

      if (options.seedImage) {
        imageBuffer = await this.geminiService.generateFromSeedImage(
          options.seedImage.buffer,
          options.seedImage.mimetype,
          options.prompt,
          DEFAULT_MODEL,
        );
      } else {
        imageBuffer = await this.geminiService.generateImage(
          options.prompt,
          DEFAULT_MODEL,
        );
      }

      if (options.brandAssetId) {
        const { buffer: overlayBuffer } =
          await this.brandAssetsService.getImageBuffer(options.brandAssetId);

        const position = (options.brandAssetPosition ??
          'bottom-right') as BrandAssetPosition;
        const scale = options.brandAssetScale ?? 25;

        imageBuffer = await this.imageCompositeService.compositeOverlay(
          imageBuffer,
          overlayBuffer,
          position,
          scale,
        );
      }

      fs.mkdirSync(UPLOAD_DIR, { recursive: true });

      const imagePath = path.join(UPLOAD_DIR, `${creative.id}.png`);
      fs.writeFileSync(imagePath, imageBuffer);

      const updated = await this.prisma.creative.update({
        where: { id: creative.id },
        data: {
          imagePath,
          status: CreativeStatus.COMPLETED,
        },
      });

      this.logger.log(
        `Creative ${creative.id} generated successfully (seed: ${!!options.seedImage}, brandAsset: ${!!options.brandAssetId})`,
      );
      return updated;
    } catch (error) {
      if (error instanceof NotFoundException) {
        await this.prisma.creative.update({
          where: { id: creative.id },
          data: {
            status: CreativeStatus.FAILED,
            errorMessage: error.message,
          },
        });
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.creative.update({
        where: { id: creative.id },
        data: {
          status: CreativeStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.warn(
        `Creative ${creative.id} generation failed: ${errorMessage}`,
      );
      throw new UnprocessableEntityException(
        `Image generation failed: ${errorMessage}`,
      );
    }
  }

  async edit(id: string, dto: EditCreativeDto): Promise<Creative> {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
    });

    if (!creative) {
      throw new NotFoundException('Creative not found');
    }

    if (
      creative.status === CreativeStatus.GENERATING ||
      creative.status === CreativeStatus.EDITING
    ) {
      throw new ConflictException('Creative is currently being processed');
    }

    if (creative.status === CreativeStatus.PENDING) {
      throw new ConflictException('Creative has no image to edit');
    }

    await this.prisma.creative.update({
      where: { id },
      data: { status: CreativeStatus.EDITING },
    });

    try {
      const imageBuffer = fs.readFileSync(creative.imagePath!);

      const newImageBuffer = await this.geminiService.editImage(
        imageBuffer,
        dto.prompt,
        DEFAULT_MODEL,
      );

      fs.writeFileSync(creative.imagePath!, newImageBuffer);

      const updated = await this.prisma.creative.update({
        where: { id },
        data: {
          prompt: dto.prompt,
          status: CreativeStatus.COMPLETED,
        },
      });

      this.logger.log(`Creative ${id} edited successfully`);
      return updated;
    } catch (error) {
      if (
        error instanceof ConflictException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.creative.update({
        where: { id },
        data: {
          status: CreativeStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.warn(`Creative ${id} edit failed: ${errorMessage}`);
      throw new UnprocessableEntityException(
        `Image editing failed: ${errorMessage}`,
      );
    }
  }

  async findAll(
    query: ListCreativesQueryDto,
  ): Promise<{ data: Creative[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { status, tag } = query;

    const where: Prisma.CreativeWhereInput = {};

    if (status) {
      where.status = status;
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const [data, total] = await Promise.all([
      this.prisma.creative.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.creative.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Creative> {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
    });

    if (!creative) {
      throw new NotFoundException('Creative not found');
    }

    return creative;
  }

  async getImageBuffer(id: string): Promise<{ buffer: Buffer; id: string }> {
    const creative = await this.findOne(id);

    if (!creative.imagePath) {
      throw new NotFoundException('Image not available');
    }

    try {
      const buffer = fs.readFileSync(creative.imagePath);
      return { buffer, id: creative.id };
    } catch {
      throw new NotFoundException('Image not available');
    }
  }

  async remove(id: string): Promise<void> {
    const creative = await this.prisma.creative.findUnique({
      where: { id },
    });

    if (!creative) {
      throw new NotFoundException('Creative not found');
    }

    if (
      creative.status === CreativeStatus.GENERATING ||
      creative.status === CreativeStatus.EDITING
    ) {
      throw new ConflictException(
        'Cannot delete creative while it is being processed',
      );
    }

    await this.prisma.creative.delete({ where: { id } });

    if (creative.imagePath) {
      try {
        fs.unlinkSync(creative.imagePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.logger.warn(
            `Failed to delete image file for creative ${id}: ${(error as Error).message}`,
          );
        }
      }
    }

    this.logger.log(`Creative ${id} deleted`);
  }
}
