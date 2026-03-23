import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Pipeline, PipelineStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreativesService } from '../creatives/creatives.service';
import { CampaignsService } from '../campaigns/campaigns.service';
import { AdSetsService } from '../ad-sets/ad-sets.service';
import { AdsService } from '../ads/ads.service';
import { CreatePipelineDto, ListPipelinesQueryDto } from './pipelines.dto';
import { PipelineStep } from './pipelines.types';

@Injectable()
export class PipelinesService {
  private readonly logger = new Logger(PipelinesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly creativesService: CreativesService,
    private readonly campaignsService: CampaignsService,
    private readonly adSetsService: AdSetsService,
    private readonly adsService: AdsService,
  ) {}

  async run(dto: CreatePipelineDto): Promise<Pipeline> {
    // Step 1: Create Pipeline record
    const pipeline = await this.prisma.pipeline.create({
      data: {
        status: PipelineStatus.PENDING,
        prompt: dto.prompt,
        config: {
          tags: dto.tags ?? [],
          campaignName: dto.campaignName,
          objective: dto.objective,
          adSetName: dto.adSetName,
          dailyBudget: dto.dailyBudget,
          targetCountries: dto.targetCountries,
          targetAgeMin: dto.targetAgeMin ?? 18,
          targetAgeMax: dto.targetAgeMax ?? 65,
          targetGenders: dto.targetGenders ?? [],
          targetInterests: dto.targetInterests
            ? dto.targetInterests.map((i) => ({ id: i.id, name: i.name }))
            : [],
          headline: dto.headline,
          body: dto.body,
          callToAction: dto.callToAction,
          linkUrl: dto.linkUrl,
        } as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`Pipeline ${pipeline.id} started`);

    let currentStep: PipelineStep = 'GENERATING_CREATIVE';

    try {
      // Step 2: Generate Creative
      currentStep = 'GENERATING_CREATIVE';
      await this.updateStatus(pipeline.id, PipelineStatus.GENERATING_CREATIVE);
      const creative = await this.creativesService.generate({
        prompt: dto.prompt,
        tags: dto.tags,
      });
      await this.updatePipeline(pipeline.id, { creativeId: creative.id });
      this.logger.log(
        `Pipeline ${pipeline.id} step GENERATING_CREATIVE completed (creativeId: ${creative.id})`,
      );

      // Step 3: Create Campaign
      currentStep = 'CREATING_CAMPAIGN';
      await this.updateStatus(pipeline.id, PipelineStatus.CREATING_CAMPAIGN);
      const campaign = await this.campaignsService.create({
        name: dto.campaignName,
        objective: dto.objective,
      });
      await this.updatePipeline(pipeline.id, { campaignId: campaign.id });
      this.logger.log(
        `Pipeline ${pipeline.id} step CREATING_CAMPAIGN completed (campaignId: ${campaign.id})`,
      );

      // Step 4: Create Ad Set
      currentStep = 'CREATING_AD_SET';
      await this.updateStatus(pipeline.id, PipelineStatus.CREATING_AD_SET);
      const optimizationGoal =
        dto.objective === 'OUTCOME_SALES'
          ? 'OFFSITE_CONVERSIONS'
          : 'LINK_CLICKS';
      const adSet = await this.adSetsService.create({
        campaignId: campaign.id,
        name: dto.adSetName,
        dailyBudget: dto.dailyBudget,
        targetCountries: dto.targetCountries,
        targetAgeMin: dto.targetAgeMin,
        targetAgeMax: dto.targetAgeMax,
        targetGenders: dto.targetGenders,
        targetInterests: dto.targetInterests,
        optimizationGoal,
        billingEvent: 'IMPRESSIONS',
      });
      await this.updatePipeline(pipeline.id, { adSetId: adSet.id });
      this.logger.log(
        `Pipeline ${pipeline.id} step CREATING_AD_SET completed (adSetId: ${adSet.id})`,
      );

      // Step 5: Create Ad
      currentStep = 'CREATING_AD';
      await this.updateStatus(pipeline.id, PipelineStatus.CREATING_AD);
      const ad = await this.adsService.create({
        adSetId: adSet.id,
        name: dto.headline,
        creativeId: creative.id,
        headline: dto.headline,
        body: dto.body,
        callToAction: dto.callToAction,
        linkUrl: dto.linkUrl,
      });
      await this.updatePipeline(pipeline.id, { adId: ad.id });
      this.logger.log(
        `Pipeline ${pipeline.id} step CREATING_AD completed (adId: ${ad.id})`,
      );

      // Step 6: Publish all
      currentStep = 'PUBLISHING';
      await this.updateStatus(pipeline.id, PipelineStatus.PUBLISHING);
      await this.campaignsService.publish(campaign.id);
      await this.adSetsService.publish(adSet.id);
      await this.adsService.publish(ad.id);
      this.logger.log(`Pipeline ${pipeline.id} step PUBLISHING completed`);

      // Step 7: Mark completed
      const completed = await this.prisma.pipeline.update({
        where: { id: pipeline.id },
        data: { status: PipelineStatus.COMPLETED },
      });

      this.logger.log(`Pipeline ${pipeline.id} completed successfully`);
      return completed;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.prisma.pipeline.update({
        where: { id: pipeline.id },
        data: {
          status: PipelineStatus.FAILED,
          failedStep: currentStep,
          errorMessage,
        },
      });

      this.logger.warn(
        `Pipeline ${pipeline.id} failed at ${currentStep}: ${errorMessage}`,
      );
      throw new UnprocessableEntityException(
        `Pipeline failed at ${currentStep}: ${errorMessage}`,
      );
    }
  }

  async findAll(query: ListPipelinesQueryDto): Promise<{
    data: Pipeline[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Prisma.PipelineWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }

    const [data, total] = await Promise.all([
      this.prisma.pipeline.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pipeline.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Pipeline> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    return pipeline;
  }

  async remove(id: string): Promise<void> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
    });

    if (!pipeline) {
      throw new NotFoundException('Pipeline not found');
    }

    if (
      pipeline.status !== PipelineStatus.COMPLETED &&
      pipeline.status !== PipelineStatus.FAILED
    ) {
      throw new ConflictException(
        `Cannot delete pipeline with status ${pipeline.status}. Only COMPLETED or FAILED pipelines can be deleted.`,
      );
    }

    await this.prisma.pipeline.delete({ where: { id } });
    this.logger.log(`Pipeline ${id} deleted`);
  }

  private async updateStatus(
    id: string,
    status: PipelineStatus,
  ): Promise<void> {
    await this.prisma.pipeline.update({
      where: { id },
      data: { status },
    });
  }

  private async updatePipeline(
    id: string,
    data: Prisma.PipelineUpdateInput,
  ): Promise<void> {
    await this.prisma.pipeline.update({
      where: { id },
      data,
    });
  }
}
