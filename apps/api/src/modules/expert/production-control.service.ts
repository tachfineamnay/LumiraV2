import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Expert, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AudioGenerationService } from '../../services/factory/AudioGenerationService';
import { DigitalSoulService } from '../../services/factory/DigitalSoulService';
import { ExpertGateway } from './expert.gateway';
import {
  ExpertReviewState,
  isActiveProductionJob,
  ProductionJobState,
  ProductionJobStatus,
  ProductionJobType,
  ProductionSummary,
  ProductionWorkflowState,
  readCurrentProduction,
  readExpertReview,
  toJson,
} from './production-control.types';

interface ClaimedProductionJob {
  orderId: string;
  orderNumber: string;
  previousOrderStatus: string;
  job: ProductionJobState;
}

interface EnqueueReadingInput extends Record<string, unknown> {
  expertPrompt?: string;
  expertInstructions?: string;
}

@Injectable()
export class ProductionControlService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ProductionControlService.name);
  private readonly activeJobIds = new Set<string>();
  private workerTimer: NodeJS.Timeout | null = null;
  private tickRunning = false;
  private lastRecoveryAt = 0;

  private readonly workerEnabled: boolean;
  private readonly pollIntervalMs: number;
  private readonly staleAfterMs: number;
  private readonly maxConcurrency: number;
  private readonly defaultMaxAttempts: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly digitalSoulService: DigitalSoulService,
    private readonly audioGenerationService: AudioGenerationService,
    private readonly gateway: ExpertGateway,
  ) {
    this.workerEnabled = this.config.get<string>('PRODUCTION_WORKER_ENABLED', 'true') !== 'false';
    this.pollIntervalMs = this.readPositiveInt('PRODUCTION_WORKER_POLL_MS', 2500);
    this.staleAfterMs = this.readPositiveInt('PRODUCTION_JOB_STALE_MS', 15 * 60 * 1000);
    this.maxConcurrency = this.readPositiveInt('PRODUCTION_WORKER_CONCURRENCY', 2);
    this.defaultMaxAttempts = this.readPositiveInt('PRODUCTION_JOB_MAX_ATTEMPTS', 3);
  }

  onModuleInit() {
    if (!this.workerEnabled) {
      this.logger.warn('Production worker disabled by PRODUCTION_WORKER_ENABLED=false');
      return;
    }

    this.workerTimer = setInterval(() => void this.tick(), this.pollIntervalMs);
    setTimeout(() => void this.tick(), 250);
    this.logger.log(
      `Production worker started (concurrency=${this.maxConcurrency}, poll=${this.pollIntervalMs}ms)`,
    );
  }

  onModuleDestroy() {
    if (this.workerTimer) clearInterval(this.workerTimer);
    this.workerTimer = null;
  }

  async enqueueReading(orderId: string, expert: Expert, input: EnqueueReadingInput = {}) {
    return this.enqueueJob(orderId, 'READING_GENERATION', expert, input);
  }

  async enqueueAudio(orderId: string, expert: Expert) {
    return this.enqueueJob(orderId, 'AUDIO_GENERATION', expert, {});
  }

  async retryJob(jobId: string, expert: Expert) {
    const located = await this.findJob(jobId);
    if (!located) throw new NotFoundException('Job de production introuvable');
    if (located.job.status !== 'FAILED' && located.job.status !== 'CANCELLED') {
      throw new BadRequestException('Seul un job échoué ou annulé peut être relancé');
    }

    return this.enqueueJob(
      located.order.id,
      located.job.type,
      expert,
      (located.job.payload || {}) as Record<string, unknown>,
    );
  }

  async cancelJob(jobId: string, expert: Expert) {
    const located = await this.findJob(jobId);
    if (!located) throw new NotFoundException('Job de production introuvable');
    if (located.job.status !== 'QUEUED') {
      throw new BadRequestException('Seul un job en attente peut être annulé');
    }
    this.assertAssignment(located.order.expertReview, expert);

    const now = new Date().toISOString();
    const cancelled: ProductionJobState = {
      ...located.job,
      status: 'CANCELLED',
      stage: 'CANCELLED',
      cancelledAt: now,
      heartbeatAt: now,
    };
    const review = readExpertReview(located.order.expertReview);

    await this.prisma.order.update({
      where: { id: located.order.id },
      data: {
        expertReview: toJson({ ...review, production: cancelled }),
      },
    });

    return cancelled;
  }

  async listJobs(options: { status?: ProductionJobStatus; limit?: number } = {}) {
    const limit = Math.min(Math.max(options.limit || 100, 1), 250);
    const orders = await this.prisma.order.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true,
        expertReview: true,
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return orders
      .map((order) => {
        const job = readCurrentProduction(order.expertReview);
        return job
          ? {
              ...job,
              orderStatus: order.status,
              orderUpdatedAt: order.updatedAt,
              user: order.user,
            }
          : null;
      })
      .filter((job): job is NonNullable<typeof job> => Boolean(job))
      .filter((job) => !options.status || job.status === options.status)
      .sort((a, b) => Date.parse(b.queuedAt) - Date.parse(a.queuedAt));
  }

  async getSummary(): Promise<ProductionSummary> {
    const jobs = await this.listJobs({ limit: 250 });
    const completedOrders = await this.prisma.order.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      select: {
        id: true,
        files: { where: { type: 'AUDIO_READING' }, select: { id: true }, take: 1 },
      },
    });

    return {
      queued: jobs.filter((job) => job.status === 'QUEUED').length,
      running: jobs.filter((job) => job.status === 'RUNNING').length,
      failed: jobs.filter((job) => job.status === 'FAILED').length,
      awaitingReview: await this.prisma.order.count({ where: { status: 'AWAITING_VALIDATION' } }),
      audioMissing: completedOrders.filter((order) => order.files.length === 0).length,
    };
  }

  async getOrderControlCenter(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { profile: true, consents: { orderBy: { acceptedAt: 'desc' } } } },
        files: { orderBy: { uploadedAt: 'desc' } },
        readingVersions: { orderBy: { version: 'desc' }, take: 10 },
        deliveries: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!order) throw new NotFoundException('Commande non trouvée');

    const review = readExpertReview(order.expertReview);
    const production = review.production;
    const latestVersion = order.readingVersions[0] || null;
    const latestDelivery = order.deliveries[0] || null;
    const audioFile = order.files.find((file) => file.type === 'AUDIO_READING') || null;
    const profile = order.user.profile;
    const checklist = {
      paymentConfirmed: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION', 'COMPLETED', 'FAILED'].includes(
        order.status,
      ),
      profileValidated: profile?.profileCompleted === true,
      birthData: Boolean(profile?.birthDate && profile?.birthPlace),
      facePhoto: Boolean(profile?.facePhotoUrl),
      palmPhoto: Boolean(profile?.palmPhotoUrl),
      consent: order.user.consents.some((consent) => !consent.revokedAt),
    };

    const workflowState = this.resolveWorkflowState({
      orderStatus: order.status,
      profileCompleted: checklist.profileValidated,
      production,
      hasSealedVersion: order.readingVersions.some((version) => version.status === 'SEALED'),
      hasPdf: Boolean(latestDelivery?.pdfKey),
      hasAudio: Boolean(audioFile),
    });

    return {
      order,
      workflowState,
      checklist,
      production: production || null,
      productionHistory: review.productionHistory || [],
      assets: {
        pdf: latestDelivery
          ? {
              status: latestDelivery.pdfKey ? 'READY' : 'MISSING',
              storageKey: latestDelivery.pdfKey,
              contentHash: latestDelivery.contentHash,
              readingVersionId: latestDelivery.readingVersionId,
            }
          : { status: 'MISSING' },
        audio: audioFile
          ? {
              status: 'READY',
              fileId: audioFile.id,
              storageKey: audioFile.key,
              url: audioFile.url,
            }
          : review.assets?.audio || { status: 'MISSING' },
        email: latestDelivery
          ? {
              status: latestDelivery.emailStatus,
              attempts: latestDelivery.emailAttempts,
              sentAt: latestDelivery.emailSentAt,
              error: latestDelivery.lastEmailError,
            }
          : { status: 'PENDING' },
      },
      latestVersion,
    };
  }

  async waitForJob(jobId: string, timeoutMs = 20 * 60 * 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const located = await this.findJob(jobId);
      if (!located) throw new NotFoundException('Job de production introuvable');
      if (located.job.status === 'SUCCEEDED') {
        return this.prisma.order.findUnique({
          where: { id: located.order.id },
          include: { user: { include: { profile: true } }, files: true },
        });
      }
      if (located.job.status === 'FAILED') {
        throw new BadRequestException(located.job.error?.message || 'La génération a échoué');
      }
      if (located.job.status === 'CANCELLED') {
        throw new BadRequestException('La génération a été annulée');
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new ConflictException('La génération continue en arrière-plan');
  }

  async recoverStaleJobs(force = false) {
    const now = Date.now();
    if (!force && now - this.lastRecoveryAt < Math.min(this.staleAfterMs / 2, 60_000)) return 0;
    this.lastRecoveryAt = now;

    const orders = await this.prisma.order.findMany({
      where: { status: { in: ['PROCESSING', 'COMPLETED', 'AWAITING_VALIDATION', 'FAILED'] } },
      orderBy: { updatedAt: 'asc' },
      take: 100,
      select: { id: true, status: true, expertReview: true },
    });

    let recovered = 0;
    for (const order of orders) {
      const job = readCurrentProduction(order.expertReview);
      if (!job || job.status !== 'RUNNING' || this.activeJobIds.has(job.id)) continue;
      const heartbeat = Date.parse(job.heartbeatAt || job.startedAt || job.queuedAt);
      if (!Number.isFinite(heartbeat) || now - heartbeat < this.staleAfterMs) continue;

      const review = readExpertReview(order.expertReview);
      if (job.attempts >= job.maxAttempts) {
        const failed: ProductionJobState = {
          ...job,
          status: 'FAILED',
          stage: 'STALE_MAX_ATTEMPTS',
          failedAt: new Date().toISOString(),
          error: { code: 'STALE_JOB', message: 'Traitement interrompu après plusieurs reprises' },
        };
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status: job.type === 'READING_GENERATION' ? 'FAILED' : order.status,
            expertReview: toJson({ ...review, production: failed }),
          },
        });
      } else {
        const requeued: ProductionJobState = {
          ...job,
          status: 'QUEUED',
          stage: 'RECOVERED_AFTER_RESTART',
          heartbeatAt: new Date().toISOString(),
          error: undefined,
        };
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            status:
              job.type === 'READING_GENERATION' && order.status === 'PROCESSING'
                ? 'FAILED'
                : order.status,
            expertReview: toJson({ ...review, production: requeued }),
          },
        });
      }
      recovered += 1;
    }

    if (recovered > 0) this.logger.warn(`Recovered ${recovered} stale production job(s)`);
    return recovered;
  }

  private async enqueueJob(
    orderId: string,
    type: ProductionJobType,
    expert: Expert,
    payload: Record<string, unknown>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Commande non trouvée');

        this.assertAssignment(order.expertReview, expert);
        this.assertJobPrerequisites(order.status, type);

        const review = readExpertReview(order.expertReview);
        const current = review.production;
        if (isActiveProductionJob(current)) {
          throw new ConflictException(
            `Un traitement est déjà actif pour cette commande (${current?.stage || current?.status})`,
          );
        }

        if (type === 'AUDIO_GENERATION') {
          const existingAudio = await tx.orderFile.findFirst({
            where: { orderId, type: 'AUDIO_READING' },
            select: { id: true },
          });
          if (existingAudio) {
            throw new ConflictException('Un audio existe déjà. Utilisez la régénération explicitement.');
          }
        }

        const now = new Date().toISOString();
        const history = [...(review.productionHistory || [])];
        if (current) history.push(current);

        const job: ProductionJobState = {
          id: `prod_${randomUUID()}`,
          orderId,
          orderNumber: order.orderNumber,
          type,
          status: 'QUEUED',
          stage: 'QUEUED',
          attempts: 0,
          maxAttempts: this.defaultMaxAttempts,
          requestedByExpertId: expert.id,
          requestedByExpertName: expert.name,
          queuedAt: now,
          heartbeatAt: now,
          payload,
        };

        const assets = { ...(review.assets || {}) };
        if (type === 'AUDIO_GENERATION') {
          assets.audio = { status: 'QUEUED', updatedAt: now };
        }

        await tx.order.update({
          where: { id: orderId },
          data: {
            expertPrompt:
              type === 'READING_GENERATION' && typeof payload.expertPrompt === 'string'
                ? payload.expertPrompt
                : order.expertPrompt,
            expertInstructions:
              type === 'READING_GENERATION' && typeof payload.expertInstructions === 'string'
                ? payload.expertInstructions
                : order.expertInstructions,
            errorLog: type === 'READING_GENERATION' ? null : order.errorLog,
            expertReview: toJson({
              ...review,
              assignedBy: review.assignedBy || expert.id,
              assignedName: review.assignedName || expert.name,
              assignedAt: review.assignedAt || now,
              production: job,
              productionHistory: history.slice(-20),
              assets,
            }),
          },
        });

        this.logger.log(`Queued ${type} ${job.id} for ${order.orderNumber}`);
        return { accepted: true, jobId: job.id, status: job.status, job };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private assertAssignment(expertReview: Prisma.JsonValue | null, expert: Expert) {
    const review = readExpertReview(expertReview);
    if (review.assignedBy && review.assignedBy !== expert.id && expert.role !== 'ADMIN') {
      throw new ForbiddenException('Cette commande est assignée à un autre expert');
    }
  }

  private assertJobPrerequisites(orderStatus: string, type: ProductionJobType) {
    if (
      type === 'READING_GENERATION' &&
      !['PAID', 'AWAITING_VALIDATION', 'FAILED'].includes(orderStatus)
    ) {
      throw new BadRequestException(
        `La lecture ne peut pas être générée depuis le statut ${orderStatus}`,
      );
    }
    if (type === 'AUDIO_GENERATION' && orderStatus !== 'COMPLETED') {
      throw new BadRequestException('Le contenu et le PDF doivent être finalisés avant l’audio');
    }
  }

  private async tick() {
    if (!this.workerEnabled || this.tickRunning) return;
    this.tickRunning = true;
    try {
      await this.recoverStaleJobs();
      while (this.activeJobIds.size < this.maxConcurrency) {
        const claimed = await this.claimNextQueuedJob();
        if (!claimed) break;
        this.activeJobIds.add(claimed.job.id);
        void this.executeClaimedJob(claimed).finally(() => {
          this.activeJobIds.delete(claimed.job.id);
          setTimeout(() => void this.tick(), 0);
        });
      }
    } catch (error) {
      this.logger.error(
        `Production worker tick failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.tickRunning = false;
    }
  }

  private async claimNextQueuedJob(): Promise<ClaimedProductionJob | null> {
    const candidates = await this.prisma.order.findMany({
      where: { status: { in: ['PAID', 'AWAITING_VALIDATION', 'FAILED', 'COMPLETED'] } },
      orderBy: { updatedAt: 'asc' },
      take: 50,
      select: { id: true, orderNumber: true, status: true, expertReview: true },
    });

    for (const candidate of candidates) {
      const job = readCurrentProduction(candidate.expertReview);
      if (!job || job.status !== 'QUEUED' || this.activeJobIds.has(job.id)) continue;

      try {
        const claimed = await this.prisma.$transaction(
          async (tx) => {
            const currentOrder = await tx.order.findUnique({
              where: { id: candidate.id },
              select: { id: true, orderNumber: true, status: true, expertReview: true },
            });
            if (!currentOrder) return null;
            const currentJob = readCurrentProduction(currentOrder.expertReview);
            if (!currentJob || currentJob.id !== job.id || currentJob.status !== 'QUEUED') {
              return null;
            }

            const now = new Date().toISOString();
            const running: ProductionJobState = {
              ...currentJob,
              status: 'RUNNING',
              stage: 'STARTING',
              attempts: currentJob.attempts + 1,
              startedAt: currentJob.startedAt || now,
              heartbeatAt: now,
              error: undefined,
            };
            const review = readExpertReview(currentOrder.expertReview);
            const assets = { ...(review.assets || {}) };
            if (running.type === 'AUDIO_GENERATION') {
              assets.audio = { status: 'GENERATING', updatedAt: now };
            }

            await tx.order.update({
              where: { id: currentOrder.id },
              data: { expertReview: toJson({ ...review, production: running, assets }) },
            });

            return {
              orderId: currentOrder.id,
              orderNumber: currentOrder.orderNumber,
              previousOrderStatus: currentOrder.status,
              job: running,
            };
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
        if (claimed) return claimed;
      } catch (error) {
        const code = (error as { code?: string })?.code;
        if (code !== 'P2034') throw error;
      }
    }

    return null;
  }

  private async executeClaimedJob(claimed: ClaimedProductionJob) {
    const heartbeat = setInterval(
      () => void this.updateRunningJob(claimed.orderId, claimed.job.id, {}),
      10_000,
    );

    try {
      if (claimed.job.type === 'READING_GENERATION') {
        await this.updateRunningJob(claimed.orderId, claimed.job.id, {
          stage: 'GENERATING_READING',
        });
        const result = await this.digitalSoulService.generateContentOnly(claimed.orderId);
        await this.completeJob(claimed.orderId, claimed.job.id, {
          archetype: result.archetype,
          stepsCreated: result.stepsCreated,
        });
        this.gateway.notifyOrderStatusChange({
          id: claimed.orderId,
          orderNumber: claimed.orderNumber,
          previousStatus: claimed.previousOrderStatus,
          newStatus: 'AWAITING_VALIDATION',
          updatedBy: claimed.job.requestedByExpertId,
        });
        this.gateway.notifyGenerationComplete(claimed.orderId, claimed.orderNumber, true);
      } else if (claimed.job.type === 'AUDIO_GENERATION') {
        await this.updateRunningJob(claimed.orderId, claimed.job.id, {
          stage: 'GENERATING_AUDIO',
        });
        await this.audioGenerationService.generateAllAudio(claimed.orderId);
        const audio = await this.prisma.orderFile.findFirst({
          where: { orderId: claimed.orderId, type: 'AUDIO_READING' },
          orderBy: { uploadedAt: 'desc' },
        });
        if (!audio) throw new Error('Aucun fichier audio principal n’a été produit');
        await this.completeJob(
          claimed.orderId,
          claimed.job.id,
          { fileId: audio.id, storageKey: audio.key },
          {
            audio: {
              status: 'READY',
              updatedAt: new Date().toISOString(),
              fileId: audio.id,
              storageKey: audio.key,
            },
          },
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failJob(claimed.orderId, claimed.job.id, message);
      if (claimed.job.type === 'READING_GENERATION') {
        this.gateway.notifyGenerationComplete(
          claimed.orderId,
          claimed.orderNumber,
          false,
          message,
        );
      }
    } finally {
      clearInterval(heartbeat);
    }
  }

  private async updateRunningJob(
    orderId: string,
    jobId: string,
    updates: Partial<ProductionJobState>,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { expertReview: true },
    });
    if (!order) return;
    const review = readExpertReview(order.expertReview);
    const current = review.production;
    if (!current || current.id !== jobId || current.status !== 'RUNNING') return;

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        expertReview: toJson({
          ...review,
          production: {
            ...current,
            ...updates,
            heartbeatAt: new Date().toISOString(),
          },
        }),
      },
    });
  }

  private async completeJob(
    orderId: string,
    jobId: string,
    result: Record<string, unknown>,
    assetUpdates?: ExpertReviewState['assets'],
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { expertReview: true },
    });
    if (!order) return;
    const review = readExpertReview(order.expertReview);
    const current = review.production;
    if (!current || current.id !== jobId) return;
    const now = new Date().toISOString();

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        expertReview: toJson({
          ...review,
          production: {
            ...current,
            status: 'SUCCEEDED',
            stage: 'COMPLETED',
            completedAt: now,
            heartbeatAt: now,
            result,
            error: undefined,
          },
          assets: { ...(review.assets || {}), ...(assetUpdates || {}) },
        }),
      },
    });
  }

  private async failJob(orderId: string, jobId: string, message: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, expertReview: true },
    });
    if (!order) return;
    const review = readExpertReview(order.expertReview);
    const current = review.production;
    if (!current || current.id !== jobId) return;
    const now = new Date().toISOString();
    const assets = { ...(review.assets || {}) };
    if (current.type === 'AUDIO_GENERATION') {
      assets.audio = { status: 'FAILED', updatedAt: now, error: message };
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status:
          current.type === 'READING_GENERATION' && order.status === 'PROCESSING'
            ? 'FAILED'
            : order.status,
        errorLog: current.type === 'READING_GENERATION' ? message : undefined,
        expertReview: toJson({
          ...review,
          production: {
            ...current,
            status: 'FAILED',
            stage: 'FAILED',
            failedAt: now,
            heartbeatAt: now,
            error: { message },
          },
          assets,
        }),
      },
    });
    this.logger.error(`Production job ${jobId} failed: ${message}`);
  }

  private async findJob(jobId: string) {
    const orders = await this.prisma.order.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 250,
      select: { id: true, status: true, expertReview: true },
    });
    for (const order of orders) {
      const review = readExpertReview(order.expertReview);
      if (review.production?.id === jobId) return { order, job: review.production };
      const historical = review.productionHistory?.find((job) => job.id === jobId);
      if (historical) return { order, job: historical };
    }
    return null;
  }

  private resolveWorkflowState(input: {
    orderStatus: string;
    profileCompleted: boolean;
    production?: ProductionJobState;
    hasSealedVersion: boolean;
    hasPdf: boolean;
    hasAudio: boolean;
  }): ProductionWorkflowState {
    if (!input.profileCompleted) return 'WAITING_CLIENT';
    if (input.production?.status === 'FAILED' || input.orderStatus === 'FAILED') return 'INCIDENT';
    if (input.production?.status === 'QUEUED' || input.production?.status === 'RUNNING') {
      return input.production.type === 'AUDIO_GENERATION'
        ? 'ASSETS_IN_PRODUCTION'
        : 'IN_PRODUCTION';
    }
    if (input.orderStatus === 'PAID') return 'READY_FOR_PRODUCTION';
    if (input.orderStatus === 'PROCESSING') return 'IN_PRODUCTION';
    if (input.orderStatus === 'AWAITING_VALIDATION') return 'AWAITING_REVIEW';
    if (input.orderStatus === 'COMPLETED' && input.hasPdf && input.hasAudio) return 'DELIVERED';
    if (input.orderStatus === 'COMPLETED' && input.hasPdf) return 'READY_FOR_DELIVERY';
    if (input.hasSealedVersion) return 'ASSETS_IN_PRODUCTION';
    return 'READY_FOR_PRODUCTION';
  }

  private readPositiveInt(key: string, fallback: number) {
    const value = Number(this.config.get<string>(key));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
}
