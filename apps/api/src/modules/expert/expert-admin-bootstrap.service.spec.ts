import { ConfigService } from '@nestjs/config';
import { ExpertRole } from '@prisma/client';
import { ExpertAdminBootstrapService } from './expert-admin-bootstrap.service';

jest.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: jest.fn().mockResolvedValue('hashed-password') },
}));

describe('ExpertAdminBootstrapService', () => {
  const existingAdmin = {
    id: 'expert-1',
    email: 'expert@oraclelumira.com',
    role: ExpertRole.EXPERT,
    isActive: true,
  };

  function createService(options?: {
    existing?: typeof existingAdmin | null;
    env?: Record<string, string | undefined>;
  }) {
    const expert = {
      findUnique: jest.fn().mockResolvedValue(options?.existing === undefined ? existingAdmin : options.existing),
      update: jest.fn().mockResolvedValue(undefined),
      create: jest.fn().mockResolvedValue(undefined),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    const prisma = {
      expert,
      $transaction: jest.fn(async (callback: (tx: { expert: typeof expert }) => Promise<void>) => callback({ expert })),
    };
    const config = {
      get: jest.fn((key: string) => options?.env?.[key]),
    };
    return {
      service: new ExpertAdminBootstrapService(
        prisma as never,
        config as unknown as ConfigService,
      ),
      expert,
    };
  }

  it('promotes and keeps the canonical account without rotating its password', async () => {
    const { service, expert } = createService();

    await service.onApplicationBootstrap();

    expect(expert.update).toHaveBeenCalledWith({
      where: { email: 'expert@oraclelumira.com' },
      data: expect.objectContaining({
        role: ExpertRole.ADMIN,
        isActive: true,
      }),
    });
    expect(expert.update.mock.calls[0][0].data).not.toHaveProperty('password');
    expect(expert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          email: { not: 'expert@oraclelumira.com' },
          role: ExpertRole.ADMIN,
          isActive: true,
        }),
      }),
    );
  });

  it('requires an explicit password to create a missing admin', async () => {
    const { service } = createService({ existing: null });
    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'ADMIN_BOOTSTRAP_PASSWORD est obligatoire',
    );
  });

  it('creates the missing canonical admin with the explicit bootstrap password', async () => {
    const { service, expert } = createService({
      existing: null,
      env: { ADMIN_BOOTSTRAP_PASSWORD: 'strong-secret' },
    });

    await service.onApplicationBootstrap();

    expect(expert.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'expert@oraclelumira.com',
        password: 'hashed-password',
        role: ExpertRole.ADMIN,
        isActive: true,
      }),
    });
  });

  it('rotates the password only when explicitly requested', async () => {
    const { service, expert } = createService({
      env: {
        ADMIN_BOOTSTRAP_ROTATE_PASSWORD: 'true',
        ADMIN_BOOTSTRAP_PASSWORD: 'new-secret',
      },
    });

    await service.onApplicationBootstrap();

    expect(expert.update).toHaveBeenCalledWith({
      where: { email: 'expert@oraclelumira.com' },
      data: expect.objectContaining({ password: 'hashed-password' }),
    });
  });

  it('refuses a different bootstrap email in V1', async () => {
    const { service } = createService({
      env: { ADMIN_BOOTSTRAP_EMAIL: 'another@example.com' },
    });
    await expect(service.onApplicationBootstrap()).rejects.toThrow(
      'ADMIN_BOOTSTRAP_EMAIL doit rester expert@oraclelumira.com',
    );
  });
});
