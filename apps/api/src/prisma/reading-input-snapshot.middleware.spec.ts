import { Prisma } from '@packages/database';
import { installReadingInputSnapshotMiddleware } from './reading-input-snapshot.middleware';

describe('reading input snapshot Prisma middleware', () => {
  let middleware: Prisma.Middleware;
  let queryRaw: jest.Mock;

  beforeEach(() => {
    queryRaw = jest.fn();
    const prisma = {
      $use: jest.fn((registered: Prisma.Middleware) => {
        middleware = registered;
      }),
      $queryRaw: queryRaw,
    };
    installReadingInputSnapshotMiddleware(prisma as never);
  });

  it('keeps original clientInputs visible to DigitalSoul when an effective snapshot exists', async () => {
    const result = await middleware(
      {
        model: 'Order',
        action: 'findUnique',
        dataPath: [],
        runInTransaction: false,
        args: {
          where: { id: 'order-1' },
          include: {
            user: { include: { profile: true } },
            files: true,
            readingIntake: true,
          },
        },
      },
      jest.fn().mockResolvedValue({
        id: 'order-1',
        clientInputs: {
          readingIntake: { contentHash: 'v1-hash' },
          readingIntakeEffective: {
            snapshotId: 'snapshot-2',
            contentHash: 'v2-hash',
            profile: { palmPhotoUrl: 's3://onboarding/user-1/palm-v2.jpg' },
          },
        },
        readingIntake: {
          id: 'intake-1',
          sealedAt: new Date('2026-08-01T10:00:00.000Z'),
          contentHash: 'v1-hash',
        },
      }),
    );

    expect(result).toMatchObject({
      clientInputs: {
        readingIntakeEffective: {
          snapshotId: 'snapshot-2',
          contentHash: 'v2-hash',
        },
      },
      readingIntake: { sealedAt: null },
    });
  });

  it('does not alter unrelated Order reads', async () => {
    const original = {
      id: 'order-1',
      clientInputs: {
        readingIntakeEffective: { snapshotId: 'snapshot-2', contentHash: 'v2-hash' },
      },
      readingIntake: { sealedAt: new Date('2026-08-01T10:00:00.000Z') },
    };
    const result = await middleware(
      {
        model: 'Order',
        action: 'findUnique',
        dataPath: [],
        runInTransaction: false,
        args: { where: { id: 'order-1' }, include: { readingIntake: true } },
      },
      jest.fn().mockResolvedValue(original),
    );

    expect(result).toBe(original);
  });

  it('links an effective SCRIBE candidate to the exact immutable snapshot', async () => {
    queryRaw.mockResolvedValue([{ id: 'snapshot-2' }]);
    const params: Prisma.MiddlewareParams = {
      model: 'ReadingVersion',
      action: 'create',
      dataPath: [],
      runInTransaction: true,
      args: {
        data: {
          orderId: 'order-1',
          status: 'DRAFT',
          content: {
            _readingSource: {
              source: 'EFFECTIVE_SNAPSHOT',
              contentHash: 'v2-hash',
            },
          },
          contentHash: 'candidate-hash',
        },
      },
    };
    const next = jest.fn().mockResolvedValue({ id: 'version-2' });

    await middleware(params, next);

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        args: expect.objectContaining({
          data: expect.objectContaining({ inputSnapshotId: 'snapshot-2' }),
        }),
      }),
    );
    expect(params.args.data.contentHash).toBe('candidate-hash');
  });
});
