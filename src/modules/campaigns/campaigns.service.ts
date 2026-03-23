import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Campaign, MetaCampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaApiService } from '../meta-api/meta-api.service';
import {
  CreateCampaignDto,
  UpdateCampaignDto,
  ListCampaignsQueryDto,
} from './campaigns.dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaApiService: MetaApiService,
  ) {}

  async create(dto: CreateCampaignDto): Promise<Campaign> {
    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        objective: dto.objective,
        status: MetaCampaignStatus.DRAFT,
      },
    });

    this.logger.log(`Campaign ${campaign.id} created`);
    return campaign;
  }

  async findAll(
    query: ListCampaignsQueryDto,
  ): Promise<{ data: Campaign[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.CampaignWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Campaign & { adSets: unknown[] }> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: { adSets: { include: { ads: true } } },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // If PAUSED or ACTIVE, only name and status can be updated
    if (
      campaign.status === MetaCampaignStatus.PAUSED ||
      campaign.status === MetaCampaignStatus.ACTIVE
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

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: dto as Prisma.CampaignUpdateInput,
    });

    this.logger.log(`Campaign ${id} updated`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      campaign.status === MetaCampaignStatus.PAUSED ||
      campaign.status === MetaCampaignStatus.ACTIVE
    ) {
      throw new ConflictException(
        `Cannot delete a campaign with status ${campaign.status}. Only DRAFT and FAILED campaigns can be deleted.`,
      );
    }

    await this.prisma.campaign.delete({ where: { id } });
    this.logger.log(`Campaign ${id} deleted`);
  }

  async publish(id: string): Promise<Campaign> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (
      campaign.status !== MetaCampaignStatus.DRAFT &&
      campaign.status !== MetaCampaignStatus.FAILED
    ) {
      throw new ConflictException('Campaign is already published');
    }

    try {
      const result = await this.metaApiService.createCampaign({
        name: campaign.name,
        objective: campaign.objective,
        status: 'PAUSED',
        special_ad_categories: [],
      });

      const updated = await this.prisma.campaign.update({
        where: { id },
        data: {
          metaCampaignId: result.id,
          status: MetaCampaignStatus.PAUSED,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Campaign ${id} published to Meta (metaCampaignId: ${result.id})`,
      );
      return updated;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.campaign.update({
        where: { id },
        data: {
          status: MetaCampaignStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.warn(`Campaign ${id} publish failed: ${errorMessage}`);
      throw new UnprocessableEntityException(`Meta API error: ${errorMessage}`);
    }
  }
}
