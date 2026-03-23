import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Ad, MetaCampaignStatus, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaApiService } from '../meta-api/meta-api.service';
import { CreateAdDto, UpdateAdDto, ListAdsQueryDto } from './ads.dto';
import { UPLOAD_DIR } from './ads.types';

@Injectable()
export class AdsService {
  private readonly logger = new Logger(AdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaApiService: MetaApiService,
  ) {}

  async create(dto: CreateAdDto): Promise<Ad> {
    // Verify parent ad set exists
    const adSet = await this.prisma.adSet.findUnique({
      where: { id: dto.adSetId },
    });

    if (!adSet) {
      throw new NotFoundException('Ad set not found');
    }

    // Verify creative exists
    const creative = await this.prisma.creative.findUnique({
      where: { id: dto.creativeId },
    });

    if (!creative) {
      throw new NotFoundException('Creative not found');
    }

    const ad = await this.prisma.ad.create({
      data: {
        adSetId: dto.adSetId,
        name: dto.name,
        creativeId: dto.creativeId,
        headline: dto.headline,
        body: dto.body,
        callToAction: dto.callToAction,
        linkUrl: dto.linkUrl,
        status: MetaCampaignStatus.DRAFT,
      },
    });

    this.logger.log(`Ad ${ad.id} created`);
    return ad;
  }

  async findAll(
    query: ListAdsQueryDto,
  ): Promise<{ data: Ad[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AdWhereInput = {};

    if (query.adSetId) {
      where.adSetId = query.adSetId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.ad.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.ad.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Ad & { creative: unknown }> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: { creative: true },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    return ad;
  }

  async update(id: string, dto: UpdateAdDto): Promise<Ad> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    // If PAUSED or ACTIVE, only name and status can be updated
    if (
      ad.status === MetaCampaignStatus.PAUSED ||
      ad.status === MetaCampaignStatus.ACTIVE
    ) {
      const lockedFields = Object.keys(dto).filter(
        (key) => key !== 'name' && key !== 'status',
      );
      if (lockedFields.length > 0) {
        throw new ConflictException(
          'Only name and status can be updated after publishing',
        );
      }
    }

    // If creativeId is being changed, verify the new creative exists
    if (dto.creativeId) {
      const creative = await this.prisma.creative.findUnique({
        where: { id: dto.creativeId },
      });

      if (!creative) {
        throw new NotFoundException('Creative not found');
      }
    }

    const updated = await this.prisma.ad.update({
      where: { id },
      data: dto as Prisma.AdUpdateInput,
    });

    this.logger.log(`Ad ${id} updated`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    if (
      ad.status === MetaCampaignStatus.PAUSED ||
      ad.status === MetaCampaignStatus.ACTIVE
    ) {
      throw new ConflictException(
        `Cannot delete an ad with status ${ad.status}. Only DRAFT and FAILED ads can be deleted.`,
      );
    }

    await this.prisma.ad.delete({ where: { id } });
    this.logger.log(`Ad ${id} deleted`);
  }

  async publish(id: string): Promise<Ad> {
    const ad = await this.prisma.ad.findUnique({
      where: { id },
      include: { adSet: true, creative: true },
    });

    if (!ad) {
      throw new NotFoundException('Ad not found');
    }

    if (
      ad.status !== MetaCampaignStatus.DRAFT &&
      ad.status !== MetaCampaignStatus.FAILED
    ) {
      throw new ConflictException('Ad is already published');
    }

    // Verify parent ad set is published
    if (!ad.adSet.metaAdSetId) {
      throw new ConflictException(
        'Parent ad set must be published before publishing an ad',
      );
    }

    // Verify creative image exists
    const imagePath = path.join(UPLOAD_DIR, `${ad.creativeId}.png`);
    if (!fs.existsSync(imagePath)) {
      throw new NotFoundException(
        `Creative image file not found at ${imagePath}`,
      );
    }

    try {
      // Step 1: Upload image (skip if already done)
      let imageHash = ad.metaImageHash;
      if (!imageHash) {
        const imageResult = await this.metaApiService.uploadImage(imagePath);
        imageHash = imageResult.hash;

        await this.prisma.ad.update({
          where: { id },
          data: { metaImageHash: imageHash },
        });
      }

      // Step 2: Create ad creative (skip if already done)
      let creativeId = ad.metaCreativeId;
      if (!creativeId) {
        const creativeResult = await this.metaApiService.createAdCreative({
          name: ad.name,
          object_story_spec: {
            page_id: this.metaApiService.getPageId(),
            link_data: {
              image_hash: imageHash,
              link: ad.linkUrl,
              message: ad.body,
              name: ad.headline,
              call_to_action: { type: ad.callToAction },
            },
          },
        });
        creativeId = creativeResult.id;

        await this.prisma.ad.update({
          where: { id },
          data: { metaCreativeId: creativeId },
        });
      }

      // Step 3: Create Meta ad
      const adResult = await this.metaApiService.createAd({
        name: ad.name,
        adset_id: ad.adSet.metaAdSetId,
        creative: { creative_id: creativeId },
        status: 'PAUSED',
      });

      const updated = await this.prisma.ad.update({
        where: { id },
        data: {
          metaAdId: adResult.id,
          status: MetaCampaignStatus.PAUSED,
          errorMessage: null,
        },
      });

      this.logger.log(`Ad ${id} published to Meta (metaAdId: ${adResult.id})`);
      return updated;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.ad.update({
        where: { id },
        data: {
          status: MetaCampaignStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.warn(`Ad ${id} publish failed: ${errorMessage}`);
      throw new UnprocessableEntityException(`Meta API error: ${errorMessage}`);
    }
  }
}
