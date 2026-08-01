import { ServiceUnavailableException } from '@nestjs/common';
import { ClientPurgeService } from './client-purge.service';

describe('ClientPurgeService', () => {
  const client = {
    id: 'client-1',
    email: 'client@example.test',
    stripeCustomerId: 'cus_123',
    profile: {
      facePhotoUrl: 's3://onboarding/client-1/face-a.jpg',
      palmPhotoUrl: 's3://onboarding/client-1/palm-a.jpg',
    },
    onboardingProgress: {
      data: { facePhoto: 's3://onboarding/client-1/face-b.jpg' },
    },
    readingIntakes: [{ data: { palmPhoto: 's3://onboarding/client-1/palm-b.jpg' } }],
    orders: [
      {
        id: 'order-1',
        orderNumber: 'LUM-1',
        generatedContent: {},
        expertReview: {},
        files: [
          { key: 'audio/readings/LUM-1/lecture.mp3', type: 'AUDIO_READING' },
          { key: 'onboarding/client-1/face-c.jpg', type: 'FACE_PHOTO' },
        ],
        deliveries: [{ pdfKey: 'readings/LUM-1/lecture.pdf' }],
      },
    ],
  };

  function setup(storageFailure = false) {
    const tx = {
      deliveryRecord: { deleteMany: jest.fn() },
      orderFile: { deleteMany: jest.fn() },
      aiRun: { deleteMany: jest.fn() },
      readingVersion: { updateMany: jest.fn(), deleteMany: jest.fn() },
      userMemory: { updateMany: jest.fn() },
      readingIntake: { deleteMany: jest.fn() },
      order: { deleteMany: jest.fn() },
      insight: { deleteMany: jest.fn() },
      productOrder: { deleteMany: jest.fn() },
      userProfile: { deleteMany: jest.fn() },
      user: { delete: jest.fn() },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(client) },
      insight: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ audioUrl: '/api/readings/audio/audio/insights/LUM-1/a.mp3' }]),
      },
      $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<void>) => {
        await callback(tx);
      }),
    };
    const s3Service = {
      listObjectKeys: jest.fn().mockResolvedValue([]),
      deleteObjectStrict: storageFailure
        ? jest.fn().mockRejectedValue(new Error('storage unavailable'))
        : jest.fn().mockResolvedValue(undefined),
    };
    const userMemoryService = { deleteRemoteForUser: jest.fn().mockResolvedValue({ deleted: 0 }) };
    return {
      service: new ClientPurgeService(
        prisma as never,
        s3Service as never,
        userMemoryService as never,
      ),
      prisma,
      s3Service,
      userMemoryService,
      tx,
    };
  }

  it('deletes Vertex memory before private assets, then database history and the account', async () => {
    const { service, s3Service, tx, userMemoryService } = setup();

    await expect(service.purge('client-1')).resolves.toEqual({
      clientId: 'client-1',
      deletedOrders: 1,
      deletedStorageObjects: 8,
    });

    expect(s3Service.listObjectKeys).toHaveBeenCalledWith('onboarding/client-1/', 'uploads');
    expect(s3Service.listObjectKeys).toHaveBeenCalledWith('readings/LUM-1/', 'readings');
    expect(s3Service.listObjectKeys).toHaveBeenCalledWith('audio/readings/LUM-1/', 'readings');
    expect(s3Service.listObjectKeys).toHaveBeenCalledWith('audio/insights/LUM-1/', 'readings');
    expect(s3Service.deleteObjectStrict).toHaveBeenCalledWith(
      'onboarding/client-1/face-a.jpg',
      'uploads',
    );
    expect(userMemoryService.deleteRemoteForUser).toHaveBeenCalledWith('client-1');
    expect(userMemoryService.deleteRemoteForUser.mock.invocationCallOrder[0]).toBeLessThan(
      s3Service.deleteObjectStrict.mock.invocationCallOrder[0],
    );
    expect(s3Service.deleteObjectStrict).toHaveBeenCalledWith(
      'audio/readings/LUM-1/lecture.mp3',
      'readings',
    );
    expect(s3Service.deleteObjectStrict).toHaveBeenCalledWith(
      'readings/LUM-1/lecture.pdf',
      'readings',
    );
    expect(s3Service.deleteObjectStrict).toHaveBeenCalledWith(
      'audio/insights/LUM-1/a.mp3',
      'readings',
    );

    expect(tx.readingVersion.updateMany).toHaveBeenCalledWith({
      where: { orderId: { in: ['order-1'] } },
      data: { parentVersionId: null },
    });
    expect(tx.readingVersion.deleteMany).toHaveBeenCalled();
    expect(tx.readingIntake.deleteMany).toHaveBeenCalledWith({ where: { userId: 'client-1' } });
    expect(tx.order.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['order-1'] } } });
    expect(tx.insight.deleteMany).toHaveBeenCalledWith({ where: { userId: 'client-1' } });
    expect(tx.userProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: 'client-1' } });
    expect(tx.userMemory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'client-1' } }),
    );
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
  });

  it('keeps database records when private storage deletion fails', async () => {
    const { service, prisma } = setup(true);

    await expect(service.purge('client-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps S3 and PostgreSQL intact when terminal remote-memory purge is refused', async () => {
    const { service, prisma, s3Service, userMemoryService } = setup();
    userMemoryService.deleteRemoteForUser.mockRejectedValue(
      new Error('deleted memory still has an unconfigured Vertex reference'),
    );

    await expect(service.purge('client-1')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(s3Service.deleteObjectStrict).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
