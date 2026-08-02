import type { Expert } from '@prisma/client';
import '../expert/expert.service';

declare module '../expert/expert.service' {
  interface ExpertService {
    reopenForRevision(
      orderId: string,
      expert: Pick<Expert, 'id' | 'email' | 'name'>,
      reason?: string,
    ): Promise<unknown>;

    generateReading(
      orderId: string,
      expert: Pick<Expert, 'id' | 'email' | 'name'>,
    ): Promise<unknown>;
  }
}

export {};
