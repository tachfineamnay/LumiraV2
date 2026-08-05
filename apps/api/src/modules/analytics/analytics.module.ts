import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { Ga4MeasurementProtocolService } from './ga4-measurement-protocol.service';
import { AnalyticsDeliveryService } from './analytics-delivery.service';
import { AnalyticsDeliveryWorker } from './analytics-delivery.worker';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [Ga4MeasurementProtocolService, AnalyticsDeliveryService, AnalyticsDeliveryWorker],
  exports: [Ga4MeasurementProtocolService, AnalyticsDeliveryService, AnalyticsDeliveryWorker],
})
export class AnalyticsModule {}
