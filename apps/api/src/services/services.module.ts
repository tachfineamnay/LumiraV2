/**
 * @fileoverview Services Module - Factory Services for Oracle Lumira.
 *
 * This module provides the core factory services:
 * - VertexOracle: Multi-Agent AI for reading generation
 * - PdfFactory: PDF generation via Gotenberg
 * - ContextDispatcher: Context-aware request orchestration
 * - AudioGenerationService: Gemini 3.1 Flash & Google Cloud TTS Audio Pipeline
 *
 * @module services/services.module
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { VertexOracle } from './factory/VertexOracle';
import { PdfFactory } from './factory/PdfFactory';
import { ContextDispatcher } from './factory/ContextDispatcher';
import { DigitalSoulService } from './factory/DigitalSoulService';
import { ReadingSourceResolver } from './factory/reading-source.resolver';
import { AudioGenerationService } from './factory/AudioGenerationService';
import { AudioScriptService } from './factory/AudioScriptService';
import { SpiritualPathBatchService } from './factory/SpiritualPathBatchService';
import { AiExecutionResolverService } from './factory/ai-execution-resolver.service';
import { AiRunService } from './factory/ai-run.service';
import { AiRuntimeCacheService } from './factory/ai-runtime-cache.service';
import { GeminiTtsProvider } from './factory/tts/GeminiTtsProvider';
import { GoogleCloudTtsProvider } from './factory/tts/GoogleCloudTtsProvider';
import { UploadsModule } from '../modules/uploads/uploads.module';

@Module({
  imports: [ConfigModule, PrismaModule, UploadsModule, ScheduleModule.forRoot()],
  providers: [
    AiRuntimeCacheService,
    AiExecutionResolverService,
    AiRunService,
    VertexOracle,
    PdfFactory,
    ContextDispatcher,
    ReadingSourceResolver,
    DigitalSoulService,
    AudioScriptService,
    GeminiTtsProvider,
    GoogleCloudTtsProvider,
    AudioGenerationService,
    SpiritualPathBatchService,
  ],
  exports: [
    AiRuntimeCacheService,
    AiExecutionResolverService,
    AiRunService,
    VertexOracle,
    PdfFactory,
    ContextDispatcher,
    DigitalSoulService,
    AudioScriptService,
    GeminiTtsProvider,
    GoogleCloudTtsProvider,
    AudioGenerationService,
    SpiritualPathBatchService,
  ],
})
export class ServicesModule {}
