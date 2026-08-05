import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsDeliveryService } from '../modules/analytics/analytics-delivery.service';
import { OrderStatus } from '@prisma/client';

async function bootstrap() {
  const args = process.argv.slice(2);
  const isApply = args.includes('--apply');
  const limitArg = args.find((a) => a.startsWith('--limit='));
  const orderIdArg = args.find((a) => a.startsWith('--order-id='));
  const sinceArg = args.find((a) => a.startsWith('--since='));

  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100;
  const filterOrderId = orderIdArg ? orderIdArg.split('=')[1] : null;
  const sinceDate = sinceArg ? new Date(sinceArg.split('=')[1]) : null;

  console.log(`=== GA4 Purchase Reconciliation ===`);
  console.log(`Mode: ${isApply ? 'APPLY (Write changes)' : 'DRY-RUN (Simulate only)'}`);
  console.log(`Limit: ${limit}`);
  if (filterOrderId) console.log(`Filter Order ID: ${filterOrderId}`);
  if (sinceDate) console.log(`Filter Since: ${sinceDate.toISOString()}`);
  console.log(`===================================\n`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const prisma = app.get(PrismaService);
  const deliveryService = app.get(AnalyticsDeliveryService);

  try {
    const whereClause: Record<string, unknown> = {
      status: { in: [OrderStatus.PAID, OrderStatus.COMPLETED] },
      paymentIntentId: { not: null },
    };

    if (filterOrderId) {
      whereClause.id = filterOrderId;
    }
    if (sinceDate) {
      whereClause.paidAt = { gte: sinceDate };
    }

    const paidOrders = await prisma.order.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    console.log(`Found ${paidOrders.length} paid orders to inspect.`);

    let missingCount = 0;
    let createdCount = 0;
    let skippedConsentCount = 0;
    let skippedClientIdCount = 0;

    for (const order of paidOrders) {
      if (!order.paymentIntentId) continue;

      const eventKey = `ga4:purchase:${order.paymentIntentId}`;
      const existing = await prisma.analyticsDelivery.findUnique({
        where: { eventKey },
      });

      if (existing) {
        continue;
      }

      missingCount++;

      if (!order.analyticsConsentGranted) {
        skippedConsentCount++;
        console.log(
          `Order ${order.id} (${order.orderNumber}): Missing delivery, but no consent recorded.`,
        );
        continue;
      }

      if (!order.ga4ClientId) {
        skippedClientIdCount++;
        console.log(
          `Order ${order.id} (${order.orderNumber}): Missing delivery, consented, but no ga4ClientId.`,
        );
        continue;
      }

      console.log(
        `[TARGET] Order ${order.id} (${order.orderNumber}): Eligible for GA4 purchase delivery (paymentIntentId=${order.paymentIntentId})`,
      );

      if (isApply) {
        await deliveryService.recordPurchase(order, order.paymentIntentId);
        createdCount++;
        console.log(`  -> Successfully created AnalyticsDelivery for ${order.id}`);
      } else {
        console.log(`  -> [DRY-RUN] Would create AnalyticsDelivery for ${order.id}`);
      }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total inspected: ${paidOrders.length}`);
    console.log(`Missing deliveries: ${missingCount}`);
    console.log(`Skipped (no consent): ${skippedConsentCount}`);
    console.log(`Skipped (no clientId): ${skippedClientIdCount}`);
    console.log(`Deliveries created: ${createdCount}`);
  } catch (err) {
    console.error('Reconciliation error:', err);
  } finally {
    await app.close();
  }
}

void bootstrap();
