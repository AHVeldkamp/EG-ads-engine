import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AdSet, MetaCampaignStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaApiService } from '../meta-api/meta-api.service';
import {
  CreateAdSetDto,
  UpdateAdSetDto,
  ListAdSetsQueryDto,
} from './ad-sets.dto';

@Injectable()
export class AdSetsService {
  private readonly logger = new Logger(AdSetsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaApiService: MetaApiService,
  ) {}

  async create(dto: CreateAdSetDto): Promise<AdSet> {
    // Verify parent campaign exists
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: dto.campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const adSet = await this.prisma.adSet.create({
      data: {
        campaignId: dto.campaignId,
        name: dto.name,
        dailyBudget: dto.dailyBudget,
        targetCountries: dto.targetCountries,
        targetAgeMin: dto.targetAgeMin ?? 18,
        targetAgeMax: dto.targetAgeMax ?? 65,
        targetGenders: dto.targetGenders ?? [],
        targetInterests: (dto.targetInterests as Prisma.InputJsonValue) ?? [],
        optimizationGoal: dto.optimizationGoal,
        billingEvent: dto.billingEvent,
        status: MetaCampaignStatus.DRAFT,
      },
    });

    this.logger.log(`Ad set ${adSet.id} created`);
    return adSet;
  }

  async findAll(
    query: ListAdSetsQueryDto,
  ): Promise<{ data: AdSet[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.AdSetWhereInput = {};

    if (query.campaignId) {
      where.campaignId = query.campaignId;
    }

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.adSet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adSet.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<AdSet & { ads: unknown[] }> {
    const adSet = await this.prisma.adSet.findUnique({
      where: { id },
      include: { ads: true },
    });

    if (!adSet) {
      throw new NotFoundException('Ad set not found');
    }

    return adSet;
  }

  async update(id: string, dto: UpdateAdSetDto): Promise<AdSet> {
    const adSet = await this.prisma.adSet.findUnique({
      where: { id },
    });

    if (!adSet) {
      throw new NotFoundException('Ad set not found');
    }

    // If PAUSED or ACTIVE, only name and status can be updated
    if (
      adSet.status === MetaCampaignStatus.PAUSED ||
      adSet.status === MetaCampaignStatus.ACTIVE
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

    const updated = await this.prisma.adSet.update({
      where: { id },
      data: dto as Prisma.AdSetUpdateInput,
    });

    this.logger.log(`Ad set ${id} updated`);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const adSet = await this.prisma.adSet.findUnique({
      where: { id },
    });

    if (!adSet) {
      throw new NotFoundException('Ad set not found');
    }

    if (
      adSet.status === MetaCampaignStatus.PAUSED ||
      adSet.status === MetaCampaignStatus.ACTIVE
    ) {
      throw new ConflictException(
        `Cannot delete an ad set with status ${adSet.status}. Only DRAFT and FAILED ad sets can be deleted.`,
      );
    }

    await this.prisma.adSet.delete({ where: { id } });
    this.logger.log(`Ad set ${id} deleted`);
  }

  async publish(id: string): Promise<AdSet> {
    const adSet = await this.prisma.adSet.findUnique({
      where: { id },
      include: { campaign: true },
    });

    if (!adSet) {
      throw new NotFoundException('Ad set not found');
    }

    if (
      adSet.status !== MetaCampaignStatus.DRAFT &&
      adSet.status !== MetaCampaignStatus.FAILED
    ) {
      throw new ConflictException('Ad set is already published');
    }

    // Verify parent campaign is published
    if (!adSet.campaign.metaCampaignId) {
      throw new ConflictException(
        'Parent campaign must be published before publishing an ad set',
      );
    }

    try {
      const result = await this.metaApiService.createAdSet({
        campaign_id: adSet.campaign.metaCampaignId,
        name: adSet.name,
        daily_budget: adSet.dailyBudget,
        optimization_goal: adSet.optimizationGoal,
        billing_event: adSet.billingEvent,
        targeting: {
          geo_locations: { countries: adSet.targetCountries },
          age_min: adSet.targetAgeMin,
          age_max: adSet.targetAgeMax,
          genders: adSet.targetGenders,
          interests: adSet.targetInterests as Array<{
            id: string;
            name: string;
          }>,
        },
        status: 'PAUSED',
      });

      const updated = await this.prisma.adSet.update({
        where: { id },
        data: {
          metaAdSetId: result.id,
          status: MetaCampaignStatus.PAUSED,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Ad set ${id} published to Meta (metaAdSetId: ${result.id})`,
      );
      return updated;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.adSet.update({
        where: { id },
        data: {
          status: MetaCampaignStatus.FAILED,
          errorMessage,
        },
      });

      this.logger.warn(`Ad set ${id} publish failed: ${errorMessage}`);
      throw new UnprocessableEntityException(`Meta API error: ${errorMessage}`);
    }
  }
}
