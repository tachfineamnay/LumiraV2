/**
 * @fileoverview DigitalSoulService - Orchestration service that ties Orders, AI, and Database together.
 * This is the main orchestrator for the reading generation pipeline.
 *
 * HARDENED VERSION with:
 * - Verbose logging at every step
 * - Data validation before PDF generation
 * - Proper error handling with errorLog saving
 * - Timeouts and retries handled by child services
 *
 * @module services/factory/DigitalSoulService
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { VertexOracle, OracleResponse, UserProfile, OrderContext } from './VertexOracle';
import { productLevelFromAmountCents, productLevelFromNumericLevel } from './product-level.util';
import { PdfFactory, ReadingPdfData } from './PdfFactory';
import {
  OrderForReadingSource,
  ReadingSourceResolver,
  ResolvedReadingSource,
} from './reading-source.resolver';
import { InsightCategory, Prisma } from '@prisma/client';
import {
  hashReadingWorkspaceSnapshot,
  isCanonicalReadingContent,
} from '../../modules/expert/reading-version';
import {
  PreparedOnboardingPhoto,
  PrivateOnboardingPhotoService,
} from '../../modules/uploads/private-onboarding-photo.service';

// S3 upload dependencies
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// =============================================================================
// TYPES
// =============================================================================

export interface GenerationResult {
  orderId: string;
  orderNumber: string;
  pdfUrl: string;
  spiritualPathId: string;
  archetype: string;
  stepsCreated: number;
}

export interface ContentGenerationResult {
  orderId: string;
  orderNumber: string;
  archetype: string;
  stepsCreated: number;
  generatedContent: OracleResponse;
}

export interface ReadingGenerationContext {
  generationKind?: 'REGENERATE';
  sourceReadingVersionId?: string;
  sourceRevision?: number;
  sourceDraftHash?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class DigitalSoulService {
  private readonly logger = new Logger(DigitalSoulService.name);
  private readonly s3Client: S3Client;
  private readonly s3Bucket: string;
  private readonly s3Region: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly vertexOracle: VertexOracle,
    private readonly pdfFactory: PdfFactory,
    private readonly readingSourceResolver: ReadingSourceResolver,
    private readonly onboardingPhotos: PrivateOnboardingPhotoService,
  ) {
    this.s3Region = this.configService.get<string>('AWS_REGION', 'eu-west-3');
    // Canonical production bucket with compatibility for older deployments.
    this.s3Bucket = this.configService.get<string>(
      'AWS_S3_BUCKET_NAME',
      this.configService.get<string>('AWS_LECTURES_BUCKET_NAME', 'oracle-lumira-lectures'),
    );

    this.s3Client = new S3Client({
      region: this.s3Region,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  // ==========================================================================
  // PHASE 1: Generate AI Content Only (for validation)
  // ==========================================================================

  /**
   * Generates AI content for review WITHOUT creating PDF.
   * Sets order status to AWAITING_VALIDATION.
   *
   * Flow:
   * 1. Retrieve Order + User Profile
   * 2. Call VertexOracle.generateFullReading()
   * 3. Validate AI response
   * 4. Persist a versioned review draft (including the GUIDE timeline)
   * 5. Set status to AWAITING_VALIDATION. The journey is promoted only when
   *    the expert seals a ReadingVersion.
   */
  async generateContentOnly(
    orderId: string,
    generationContext: ReadingGenerationContext = {},
  ): Promise<ContentGenerationResult> {
    const startTime = Date.now();

    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log(`🔮 GENERATING CONTENT FOR VALIDATION: ${orderId}`);
    this.logger.log(`${'='.repeat(60)}`);

    try {
      // STEP 1: Load order
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: { include: { profile: true } },
          files: true,
          readingIntake: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order not found: ${orderId}`);
      }

      this.logger.log(`📋 Order: ${order.orderNumber} | Status: ${order.status}`);

      const validContentStatuses = ['PAID', 'AWAITING_VALIDATION', 'FAILED'];
      if (!validContentStatuses.includes(order.status)) {
        throw new BadRequestException(`Order not ready for generation: ${order.status}`);
      }

      // Atomic status transition to prevent concurrent processing
      // Only transition FROM non-PROCESSING states TO PROCESSING
      const lockableStatuses = ['PAID', 'AWAITING_VALIDATION', 'FAILED'];
      const locked = await this.acquireProcessingLock(orderId, lockableStatuses);
      if (!locked) {
        throw new ConflictException(
          `Order ${orderId} is already being processed by another request`,
        );
      }

      const user = order.user;
      const { userProfile, readingSource } = this.resolveReadingProfile(order);
      const visualAssets = (await this.prepareVisualAssets(user.id, readingSource.profile)).map(
        (asset) => ({
          mimeType: asset.contentType as 'image/jpeg' | 'image/png' | 'image/webp',
          base64: asset.base64,
          role: asset.role,
          width: asset.width,
          height: asset.height,
          orientation: asset.orientation,
          sha256: asset.sha256,
          analysisLimited: asset.analysisLimited,
          warnings: asset.warnings,
        }),
      );

      this.logger.log(`👤 User: ${user.firstName} ${user.lastName}`);
      this.logger.log(`📎 Reading source for generation: ${readingSource.source}`);

      const { level: orderLevel, productName: orderProductName } = this.getLevelFromAmount(
        order.amount,
      );
      const orderContext: OrderContext = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        level: productLevelFromNumericLevel(orderLevel),
        productLevel: productLevelFromAmountCents(order.amount),
        productName: orderProductName,
        expertPrompt: order.expertPrompt ?? undefined,
        expertInstructions: order.expertInstructions ?? undefined,
        intakeContentHash: readingSource.contentHash ?? undefined,
      };

      // STEP 2: Generate AI content
      this.logger.log(`🔮 Calling Vertex AI...`);
      const aiStartTime = Date.now();

      let aiResponse: OracleResponse;
      try {
        aiResponse = await this.vertexOracle.generateFullReading(
          userProfile,
          orderContext,
          visualAssets,
        );
        this.logger.log(`✅ AI response in ${Date.now() - aiStartTime}ms`);
        this.logger.log(`   🎭 Archetype: ${aiResponse.synthesis?.archetype}`);
      } catch (error) {
        const errorMsg = `AI generation failed: ${error instanceof Error ? error.message : String(error)}`;
        this.logger.error(`❌ ${errorMsg}`);
        await this.saveErrorAndFail(orderId, errorMsg);
        throw new BadRequestException(errorMsg);
      }

      // STEP 3: Validate AI response
      const validationErrors = this.validateAiResponse(aiResponse);
      if (validationErrors.length > 0) {
        const errorMsg = `AI returned invalid content: ${validationErrors.join('; ')}`;
        await this.saveErrorAndFail(orderId, errorMsg);
        throw new BadRequestException(errorMsg);
      }

      if (aiResponse.pipeline?.qualityStatus === 'BLOCKED') {
        const errorMsg = `AI candidate blocked by reading quality validation: ${
          aiResponse.pipeline.blockingIssues.map((issue) => issue.message).join('; ') ||
          'blocking issue reported'
        }`;
        await this.saveErrorAndFail(orderId, errorMsg);
        throw new BadRequestException(errorMsg);
      }

      // STEP 4: Atomically promote the validated candidate. A regeneration
      // must never reset an already-started path or overwrite the readable
      // draft until all writes needed by the candidate can commit together.
      let stepsCreated = 0;
      try {
        const result = await this.prisma.$transaction(async (tx) => {
          const isRegeneration = generationContext.generationKind === 'REGENERATE';
          const currentOrder = isRegeneration
            ? await tx.order.findUnique({
                where: { id: orderId },
                select: { generatedContent: true },
              })
            : null;
          const currentGenerated = currentOrder?.generatedContent as Record<string, unknown> | null;
          const sourceMatches =
            !isRegeneration ||
            (Boolean(currentGenerated) &&
              typeof generationContext.sourceRevision === 'number' &&
              typeof generationContext.sourceDraftHash === 'string' &&
              typeof generationContext.sourceReadingVersionId === 'string' &&
              (typeof currentGenerated.readingRevision === 'number'
                ? currentGenerated.readingRevision
                : 0) === generationContext.sourceRevision &&
              hashReadingWorkspaceSnapshot(currentGenerated) === generationContext.sourceDraftHash);

          const candidatePayload = this.withReadingSourceMetadata(
            {
              ...aiResponse,
              readingRevision: 0,
              blockVersions: {},
              expertEditHistory: [],
              ...(isRegeneration
                ? {
                    generationKind: 'REGENERATE',
                    sourceReadingVersionId: generationContext.sourceReadingVersionId,
                    sourceRevision: generationContext.sourceRevision,
                    sourceDraftHash: generationContext.sourceDraftHash,
                  }
                : {}),
            },
            readingSource,
          ) as Record<string, unknown>;
          const latestVersion = await tx.readingVersion.findFirst({
            where: { orderId },
            orderBy: { version: 'desc' },
            select: { version: true },
          });
          const currentPayload = currentOrder?.generatedContent as Record<string, unknown> | null;
          const inheritedParentVersionId =
            typeof currentPayload?.workingReadingVersionId === 'string'
              ? currentPayload.workingReadingVersionId
              : typeof currentPayload?.canonicalReadingVersionId === 'string'
                ? currentPayload.canonicalReadingVersionId
                : null;
          const candidateVersion = await tx.readingVersion.create({
            data: {
              orderId,
              version: (latestVersion?.version || 0) + 1,
              status: 'DRAFT',
              content: candidatePayload as Prisma.InputJsonValue,
              contentHash: hashReadingWorkspaceSnapshot(candidatePayload),
              source: isRegeneration
                ? sourceMatches
                  ? 'SCRIBE_REGENERATE_CANDIDATE'
                  : 'SCRIBE_REGENERATE_CONFLICT_CANDIDATE'
                : 'SCRIBE_CANDIDATE',
              parentVersionId: generationContext.sourceReadingVersionId || inheritedParentVersionId,
            },
            select: { id: true },
          });
          const candidateVersionId = candidateVersion.id;
          if (!sourceMatches) {
            return { created: 0, conflict: true, candidateVersionId };
          }
          candidatePayload.workingReadingVersionId = candidateVersionId;
          candidatePayload.candidateReadingVersionId = candidateVersionId;
          await tx.order.update({
            where: { id: orderId },
            data: {
              status: 'AWAITING_VALIDATION',
              generatedContent: candidatePayload as Prisma.InputJsonValue,
              errorLog: null,
            },
          });
          return { created: 0, conflict: false, candidateVersionId };
        });
        if (result.conflict) {
          throw new ConflictException(
            `Le brouillon source a changé pendant la régénération; le candidat ${result.candidateVersionId} est conservé sans application.`,
          );
        }
        stepsCreated = result.created;
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        const errorMsg = `Database transaction failed: ${error instanceof Error ? error.message : String(error)}`;
        await this.saveErrorAndFail(orderId, errorMsg);
        throw new BadRequestException(errorMsg);
      }

      const elapsed = Date.now() - startTime;
      this.logger.log(`\n${'='.repeat(60)}`);
      this.logger.log(`✅ CONTENT READY FOR VALIDATION: ${order.orderNumber}`);
      this.logger.log(`   🎭 Archetype: ${aiResponse.synthesis.archetype}`);
      this.logger.log(`   📅 Steps: ${stepsCreated}`);
      this.logger.log(`   ⏱️ Time: ${elapsed}ms`);
      this.logger.log(`${'='.repeat(60)}\n`);

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        archetype: aiResponse.synthesis.archetype,
        stepsCreated,
        generatedContent: aiResponse,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`💥 Content generation failed: ${errorMsg}`);
      if (!(error instanceof ConflictException)) {
        await this.saveErrorAndFail(orderId, errorMsg).catch(() => {});
      }
      throw error;
    }
  }

  // ==========================================================================
  // PHASE 2: Finalize with PDF (after validation approval)
  // ==========================================================================

  /**
   * Generates PDF and finalizes order after expert validation.
   * Only works for orders with status AWAITING_VALIDATION.
   */
  async finalizeWithPdf(orderId: string): Promise<GenerationResult> {
    const startTime = Date.now();

    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log(`📄 FINALIZING ORDER WITH PDF: ${orderId}`);
    this.logger.log(`${'='.repeat(60)}`);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { include: { profile: true } },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order not found: ${orderId}`);
    }

    if (order.status !== 'AWAITING_VALIDATION') {
      throw new BadRequestException(`Order must be AWAITING_VALIDATION, got: ${order.status}`);
    }

    const sealedReading = await this.prisma.readingVersion.findFirst({
      where: { orderId, status: 'SEALED' },
      orderBy: { version: 'desc' },
    });
    if (!sealedReading || !isCanonicalReadingContent(sealedReading.content)) {
      throw new BadRequestException(
        'Aucune version scellée et valide de la lecture n’est disponible pour la génération PDF',
      );
    }
    const aiResponse = sealedReading.content as unknown as OracleResponse;

    const user = order.user;
    const { userProfile, readingSource } = this.resolveReadingProfile(order);

    // Generate PDF
    this.logger.log(`📄 Generating PDF for ${user.firstName} ${user.lastName}...`);
    this.logger.log(`📎 Reading source for PDF birth data: ${readingSource.source}`);

    const pdfData: ReadingPdfData = {
      userName: `${user.firstName} ${user.lastName}`,
      archetype: aiResponse.synthesis.archetype,
      archetypeDescription: aiResponse.pdf_content.archetype_reveal,
      keywords: aiResponse.synthesis.keywords || [],
      introduction: aiResponse.pdf_content.introduction,
      sections: aiResponse.pdf_content.sections.map((s) => ({
        domain: s.domain,
        title: s.title,
        content: s.content,
      })),
      karmicInsights: aiResponse.pdf_content.karmic_insights || [],
      lifeMission: aiResponse.pdf_content.life_mission || '',
      rituals: aiResponse.pdf_content.rituals || [],
      conclusion: aiResponse.pdf_content.conclusion,
      birthData: {
        date: userProfile.birthDate,
        time: userProfile.birthTime,
        place: userProfile.birthPlace,
      },
      generatedAt: new Date().toISOString(),
    };

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfFactory.generatePdf('reading', pdfData);
      this.logger.log(`✅ PDF generated: ${Math.round(pdfBuffer.length / 1024)}KB`);
    } catch (error) {
      const errorMsg = `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`;
      await this.saveErrorAndFail(orderId, errorMsg);
      throw new BadRequestException(errorMsg);
    }

    // Upload to S3
    const pdfKey = `readings/${order.orderNumber}/${Date.now()}-lecture.pdf`;
    let pdfUrl: string;

    try {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: pdfKey,
          Body: pdfBuffer,
          ContentType: 'application/pdf',
          Metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            userId: user.id,
            readingVersionId: sealedReading.id,
            contentHash: sealedReading.contentHash,
          },
        }),
      );
      // Use API endpoint for signed URL access (S3 bucket is private)
      pdfUrl = `/api/readings/${order.orderNumber}/download`;
      await this.prisma.deliveryRecord.upsert({
        where: {
          orderId_readingVersionId: {
            orderId: order.id,
            readingVersionId: sealedReading.id,
          },
        },
        create: {
          orderId: order.id,
          readingVersionId: sealedReading.id,
          pdfKey,
          contentHash: sealedReading.contentHash,
        },
        update: {
          pdfKey,
          contentHash: sealedReading.contentHash,
        },
      });
      this.logger.log(`☁️ PDF uploaded to S3: ${pdfKey}`);
      this.logger.log(`🔗 Access URL: ${pdfUrl}`);
    } catch (error) {
      const errorMsg = `S3 upload failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(`❌ ${errorMsg}`);
      await this.saveErrorAndFail(orderId, errorMsg);
      throw new BadRequestException(errorMsg);
    }

    // Get spiritualPath ID
    const spiritualPath = await this.prisma.spiritualPath.findFirst({
      where: { userId: user.id, readingVersionId: sealedReading.id },
    });

    // Upsert Insights from AI sections
    await this.upsertInsightsFromSections(user.id, orderId, aiResponse);

    // Finalize order
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'COMPLETED',
        deliveredAt: new Date(),
        errorLog: null,
        generatedContent: {
          ...aiResponse,
          pdfUrl,
          pdfKey,
          canonicalReadingVersionId: sealedReading.id,
          canonicalContentHash: sealedReading.contentHash,
        } as object,
      },
    });

    const elapsed = Date.now() - startTime;
    this.logger.log(`\n${'='.repeat(60)}`);
    this.logger.log(`🎉 ORDER COMPLETED: ${order.orderNumber}`);
    this.logger.log(`   📄 PDF: ${Math.round(pdfBuffer.length / 1024)}KB`);
    this.logger.log(`   ⏱️ Time: ${elapsed}ms`);
    this.logger.log(`${'='.repeat(60)}\n`);

    // Audio is enqueued by ExpertService after seal (managed AUDIO_GENERATION job).
    // Do not fire-and-forget generateAllAudio here — it no-ops without a RUNNING job.

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      pdfUrl,
      spiritualPathId: spiritualPath?.id || '',
      archetype: aiResponse.synthesis.archetype,
      stepsCreated: aiResponse.timeline?.length || 0,
    };
  }

  // ==========================================================================
  // Validation helper
  // ==========================================================================

  private validateAiResponse(aiResponse: OracleResponse): string[] {
    const errors: string[] = [];

    if (!aiResponse.pdf_content) {
      errors.push('Missing pdf_content');
    } else {
      if (!aiResponse.pdf_content.introduction || aiResponse.pdf_content.introduction.length < 50) {
        errors.push('Introduction is empty or too short');
      }
      if (!aiResponse.pdf_content.sections || aiResponse.pdf_content.sections.length === 0) {
        errors.push('No sections in pdf_content');
      }
      if (!aiResponse.pdf_content.conclusion || aiResponse.pdf_content.conclusion.length < 20) {
        errors.push('Conclusion is empty or too short');
      }
    }

    if (!aiResponse.synthesis) {
      errors.push('Missing synthesis');
    } else if (!aiResponse.synthesis.archetype) {
      errors.push('Missing archetype in synthesis');
    }

    if (!aiResponse.timeline || aiResponse.timeline.length === 0) {
      errors.push('Missing or empty timeline');
    }

    return errors;
  }

  private resolveReadingProfile(
    order: OrderForReadingSource & {
      files?: unknown[];
      readingIntake?: { data: unknown; sealedAt: Date | null; contentHash: string | null } | null;
    },
  ): {
    userProfile: UserProfile;
    readingSource: ResolvedReadingSource;
  } {
    // ReadingIntake is the canonical order-scoped source. clientInputs is kept
    // only for orders created before the intake migration.
    const intake = order.readingIntake;
    const sourceOrder = intake?.sealedAt
      ? {
          ...order,
          clientInputs: {
            readingIntake: {
              sealedAt: intake.sealedAt.toISOString(),
              contentHash: intake.contentHash,
              profile: intake.data,
            },
          },
        }
      : order;
    const readingSource = this.readingSourceResolver.resolve(sourceOrder);
    const userProfile = this.readingSourceResolver.toVertexUserProfile(order.user, readingSource);
    return { userProfile, readingSource };
  }

  private async prepareVisualAssets(
    userId: string,
    profile: ResolvedReadingSource['profile'],
  ): Promise<PreparedOnboardingPhoto[]> {
    const requested: Array<{
      kind: 'face' | 'palm';
      storageRef: string | null;
      role?: 'FACE_FRONT' | 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
    }> = [
      { kind: 'face', storageRef: profile.facePhotoUrl, role: 'FACE_FRONT' },
      { kind: 'palm', storageRef: profile.palmPhotoUrl, role: profile.palmRole ?? 'PALM_UNKNOWN' },
    ];
    const assets: PreparedOnboardingPhoto[] = [];
    for (const asset of requested) {
      if (!asset.storageRef) continue;
      try {
        assets.push(
          await this.onboardingPhotos.prepareForAi(
            asset.storageRef,
            userId,
            asset.kind,
            asset.role,
          ),
        );
      } catch (error) {
        if (asset.kind !== 'palm') throw error;
        // A malformed historical palm must never make SCRIBE invent palmistry
        // or block the rest of the reading. The warning is persisted in pipeline metadata.
        assets.push({
          storageRef: '',
          key: 'unavailable-palm',
          contentType: 'image/jpeg',
          size: 0,
          etag: 'unavailable',
          versionId: null,
          kind: 'palm',
          role: asset.role ?? 'PALM_UNKNOWN',
          width: 0,
          height: 0,
          orientation: null,
          sha256: 'unavailable',
          base64: '',
          analysisLimited: true,
          warnings: ['Paume inutilisable : lecture produite sans chiromancie.'],
        });
      }
    }
    return assets;
  }

  private withReadingSourceMetadata(
    payload: OracleResponse | Record<string, unknown>,
    readingSource: ResolvedReadingSource,
  ): object {
    return {
      ...(payload as Record<string, unknown>),
      _readingSource: {
        source: readingSource.source,
        sealedAt: readingSource.sealedAt ?? null,
        contentHash: readingSource.contentHash ?? null,
      },
    };
  }

  /**
   * Saves error to order and sets status to FAILED
   */
  private async saveErrorAndFail(orderId: string, errorMessage: string): Promise<void> {
    try {
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          status: 'FAILED',
          errorLog: `[${new Date().toISOString()}] ${errorMessage}`,
        },
      });
      this.logger.log(`   💾 Error saved to order.errorLog`);
    } catch (dbError) {
      this.logger.error(`   ❌ Could not save error to database: ${dbError}`);
    }
  }

  private getLevelFromAmount(amountCents: number): { level: number; productName: string } {
    if (amountCents <= 2900) return { level: 1, productName: 'Initié' };
    if (amountCents <= 5900) return { level: 2, productName: 'Mystique' };
    if (amountCents <= 9900) return { level: 3, productName: 'Profond' };
    return { level: 4, productName: 'Intégral' };
  }

  /**
   * Atomic optimistic lock: transitions order to PROCESSING only if current status is in allowedStatuses.
   * Returns true if lock acquired, false if another request got there first.
   */
  private async acquireProcessingLock(
    orderId: string,
    allowedStatuses: string[],
  ): Promise<boolean> {
    const result = await this.prisma.$executeRawUnsafe(
      `UPDATE "Order" SET status = 'PROCESSING', "errorLog" = NULL, "updatedAt" = NOW()
             WHERE id = $1 AND status::text = ANY($2)`,
      orderId,
      allowedStatuses,
    );
    return result > 0;
  }

  /**
   * Maps AI pdf_content.sections to Insight records (one per category).
   * Each section.domain must match an InsightCategory enum value.
   */
  private async upsertInsightsFromSections(
    userId: string,
    orderId: string,
    aiResponse: OracleResponse,
  ): Promise<number> {
    const validCategories = new Set([
      'SPIRITUEL',
      'RELATIONS',
      'MISSION',
      'CREATIVITE',
      'EMOTIONS',
      'TRAVAIL',
      'SANTE',
      'FINANCE',
    ]);

    const sections = aiResponse.pdf_content?.sections || [];
    const matchedSections = sections.filter((s) => validCategories.has(s.domain?.toUpperCase()));

    if (matchedSections.length === 0) {
      this.logger.warn(`⚠️ No sections matched InsightCategory domains — skipping Insight upsert`);
      return 0;
    }

    const operations = matchedSections.map((section) => {
      const category = section.domain.toUpperCase() as InsightCategory;
      // Short = first 300 chars of content, Full = entire content
      const short =
        section.content.length > 300 ? section.content.slice(0, 297) + '...' : section.content;

      return this.prisma.insight.upsert({
        where: { userId_category: { userId, category } },
        create: {
          userId,
          orderId,
          category,
          short,
          full: section.content,
          viewedAt: null,
        },
        update: {
          orderId,
          short,
          full: section.content,
          viewedAt: null,
          updatedAt: new Date(),
        },
      });
    });

    await this.prisma.$transaction(operations);
    this.logger.log(`   📊 Upserted ${operations.length} Insight records`);
    return operations.length;
  }
}
