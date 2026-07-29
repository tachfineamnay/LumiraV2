import * as dotenv from 'dotenv';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PaymentsService } from '../modules/payments/payments.service';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const apply = process.argv.includes('--apply');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const payments = app.get(PaymentsService);
    const report = await payments.reconcileEarlyCheckoutPayments(apply);
    console.log(JSON.stringify(report));
  } finally {
    await app.close();
  }
}

main().catch(() => {
  // Do not emit config, Stripe, payment, or user details from this operator tool.
  console.error('Stripe reconciliation failed. Check service configuration and restricted logs.');
  process.exitCode = 1;
});
