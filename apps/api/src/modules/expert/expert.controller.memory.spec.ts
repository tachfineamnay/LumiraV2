import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExpertController } from './expert.controller';
import { RolesGuard } from './guards/roles.guard';

describe('ExpertController memory authorization', () => {
  const controller = new ExpertController(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  const guard = new RolesGuard(new Reflector());

  function context(expert?: { role: string }) {
    return {
      getHandler: () => controller.listClientMemories,
      getClass: () => ExpertController,
      switchToHttp: () => ({ getRequest: () => ({ expert }) }),
    };
  }

  it('marks every Memory Bank operation ADMIN-only', () => {
    for (const handler of [
      controller.listClientMemories,
      controller.approveMemory,
      controller.editMemory,
      controller.rejectMemory,
      controller.deleteMemory,
      controller.resyncMemory,
      controller.listMemoryJobs,
      controller.retryMemoryJob,
      controller.backfillMemoryJobs,
      controller.runMemoryDiagnostic,
    ]) {
      expect(
        guard.canActivate({ ...context({ role: 'ADMIN' }), getHandler: () => handler } as never),
      ).toBe(true);
    }
  });

  it('rejects unauthenticated and EXPERT calls while accepting ADMIN', () => {
    expect(() => guard.canActivate(context() as never)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context({ role: 'EXPERT' }) as never)).toThrow(
      ForbiddenException,
    );
    expect(guard.canActivate(context({ role: 'ADMIN' }) as never)).toBe(true);
  });
});
