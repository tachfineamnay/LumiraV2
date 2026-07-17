import { AppService } from './app.service';

describe('AppService', () => {
  it('reports the API healthy only when PostgreSQL answers', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const service = new AppService(prisma as never);

    await expect(service.getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'api',
      database: 'ok',
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('propagates a database outage so the health endpoint returns an error', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('database unavailable')) };
    const service = new AppService(prisma as never);

    await expect(service.getHealth()).rejects.toThrow('database unavailable');
  });
});
