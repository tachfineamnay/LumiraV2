import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@packages/database';
import { installReadingInputSnapshotMiddleware } from './reading-input-snapshot.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private snapshotMiddlewareInstalled = false;

  async onModuleInit() {
    if (!this.snapshotMiddlewareInstalled) {
      installReadingInputSnapshotMiddleware(this);
      this.snapshotMiddlewareInstalled = true;
    }
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
