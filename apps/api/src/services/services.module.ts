/**
 * @fileoverview Services Module - Factory Services for Oracle Lumira.
 *
 * This module provides the core factory services:
 * - VertexOracle: Multi-Agent AI for reading generation
 * - PdfFactory: PDF generation via Gotenberg
 * - ContextDispatcher: Context-aware request orchestration
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
import { AiRoutingService } from '../modules/settings/ai-routing.service';
import { AiExecutionResolverService } from './factory/ai-execution-resolver.service';
import { AiRunService } from './factory/ai-run.service';
import { AiRuntimeCacheService } from './factory/ai-runtime-cache.service';

@Module({
  imports: [ConfigModule, PrismaModule, ScheduleModule.forRoot()],
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
    AudioGenerationService,
    SpiritualPathBatchService,
    AiRoutingService,
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
    AudioGenerationService,
    SpiritualPathBatchService,
    AiRoutingService,
  ],
})
export class ServicesModule {}
