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
import { PrismaModule } from '../prisma/prisma.module';
import { VertexOracle } from './factory/VertexOracle';
import { PdfFactory } from './factory/PdfFactory';
import { ContextDispatcher } from './factory/ContextDispatcher';
import { DigitalSoulService } from './factory/DigitalSoulService';

@Module({
    imports: [
        ConfigModule,
        PrismaModule,
    ],
    providers: [
        VertexOracle,
        PdfFactory,
        ContextDispatcher,
        DigitalSoulService,
    ],
    exports: [
        VertexOracle,
        PdfFactory,
        ContextDispatcher,
        DigitalSoulService,
    ],
})
export class ServicesModule {}
