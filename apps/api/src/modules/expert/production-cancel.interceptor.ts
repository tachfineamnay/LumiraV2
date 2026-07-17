import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { from, mergeMap, Observable } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { readCurrentProduction } from './production-control.types';

type ExpertRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
};

@Injectable()
export class ProductionCancelInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<ExpertRequest>();
    const path = (request.originalUrl || request.url || '').split('?')[0];
    const match = path.match(/\/expert\/production\/jobs\/([^/]+)\/cancel$/);

    if (request.method !== 'POST' || !match) return next.handle();

    return from(this.assertCurrentQueuedJob(match[1])).pipe(mergeMap(() => next.handle()));
  }

  private async assertCurrentQueuedJob(jobId: string): Promise<void> {
    const orders = await this.prisma.order.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 250,
      select: { expertReview: true },
    });

    const current = orders
      .map((order) => readCurrentProduction(order.expertReview))
      .find((job) => job?.id === jobId);

    if (!current || current.status !== 'QUEUED') {
      throw new BadRequestException('Seul le traitement courant en attente peut être annulé');
    }
  }
}
