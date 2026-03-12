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
import { AudioGenerationService } from './factory/AudioGenerationService';
import { SpiritualPathBatchService } from './factory/SpiritualPathBatchService';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
        ScheduleModule.forRoot(),
    ],
    providers: [
        VertexOracle,
        PdfFactory,
        ContextDispatcher,
        DigitalSoulService,
        AudioGenerationService,
        SpiritualPathBatchService,
    ],
    exports: [
        VertexOracle,
        PdfFactory,
        ContextDispatcher,
        DigitalSoulService,
        AudioGenerationService,
        SpiritualPathBatchService,
    ],
})
export class ServicesModule {}
