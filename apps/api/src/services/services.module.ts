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
import { MemoryConfigService } from './memory/memory-config.service';
import { MemoryReadinessService } from './memory/memory-readiness.service';
import { MemorySanitizerService } from './memory/memory-sanitizer.service';
import { VertexMemoryBankClient } from './memory/vertex-memory-bank.client';
import { UserMemoryService } from './memory/user-memory.service';
import { MemorySyncService } from './memory/memory-sync.service';
import { MemorySyncWorkerService } from './memory/memory-sync-worker.service';
import { MemoryContextBuilder } from './memory/memory-context-builder.service';

@Module({
  imports: [ConfigModule, PrismaModule, UploadsModule, ScheduleModule.forRoot()],
  providers: [
    AiRuntimeCacheService,
    AiExecutionResolverService,
    AiRunService,
    MemoryConfigService,
    MemoryReadinessService,
    MemorySanitizerService,
    VertexMemoryBankClient,
    UserMemoryService,
    MemorySyncService,
    MemoryContextBuilder,
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
    MemorySyncWorkerService,
  ],
  exports: [
    AiRuntimeCacheService,
    AiExecutionResolverService,
    AiRunService,
    MemoryConfigService,
    MemoryReadinessService,
    VertexMemoryBankClient,
    UserMemoryService,
    MemorySyncService,
    MemoryContextBuilder,
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
