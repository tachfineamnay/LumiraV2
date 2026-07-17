import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock @packages/shared
jest.mock('@packages/shared', () => ({
  aggregateCapabilities: jest.fn((levels: number[]) =>
    levels.length > 0 ? ['content.basic', 'readings.pdf', 'chat_unlimited', 'dreams'] : [],
  ),
  getHighestLevel: jest.fn((levels: number[]) => (levels.length > 0 ? Math.max(...levels) : 0)),
}));

describe('UsersService', () => {
  let service: UsersService;
  let prisma: Record<string, any>;

  const mockUser = {
    id: 'user-1',
    email: 'marie@test.com',
    firstName: 'Marie',
    lastName: 'Dubois',
    phone: '+33612345678',
    stripeCustomerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: {
      userId: 'user-1',
      birthDate: '1990-06-15',
      birthTime: '14:30',
      birthPlace: 'Lyon',
      specificQuestion: 'Ma mission ?',
      objective: 'Croissance',
      profileCompleted: true,
      submittedAt: new Date(),
    },
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      expert: {
        findUnique: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      userProfile: {
        upsert: jest.fn(),
      },
      consentRecord: {
        upsert: jest.fn(),
      },
      onboardingProgress: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // =========================================================================
  // getEntitlements
  // =========================================================================

  describe('getEntitlements', () => {
    it('should return level 4 capabilities for any paid order', async () => {
      prisma.order.count.mockResolvedValue(1);

      const result = await service.getEntitlements('user-1');

      expect(result.highestLevel).toBe(4);
      expect(result.capabilities.length).toBeGreaterThan(0);
      expect(result.products).toContain('lifetime-access');
      expect(result.orderCount).toBe(1);
    });

    it('should return level 0 with no capabilities for no paid order', async () => {
      prisma.order.count.mockResolvedValue(0);

      const result = await service.getEntitlements('user-1');

      expect(result.highestLevel).toBe(0);
      expect(result.capabilities).toEqual([]);
      expect(result.products).toEqual([]);
      expect(result.orderCount).toBe(0);
    });

    it('does not inspect subscription status to determine lifetime access', async () => {
      prisma.order.count.mockResolvedValue(2);

      const result = await service.getEntitlements('user-1');

      expect(result.highestLevel).toBe(4);
      expect(prisma.subscription.findUnique).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // findUserWithPaidOrder
  // =========================================================================

  describe('findUserWithPaidOrder', () => {
    it('should return user when paid order exists', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order.findFirst.mockResolvedValue({ id: 'order-1', status: 'PAID', amount: 2900 });

      const result = await service.findUserWithPaidOrder('marie@test.com');

      expect(result).toBeTruthy();
      expect(result!.email).toBe('marie@test.com');
    });

    it('should return null when no user found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findUserWithPaidOrder('nobody@test.com');

      expect(result).toBeNull();
    });

    it('should return null when user has no valid orders', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.findMany.mockResolvedValue([]); // debug logging

      const result = await service.findUserWithPaidOrder('marie@test.com');

      expect(result).toBeNull();
    });

    it('should normalize email (lowercase + trim)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.findUserWithPaidOrder('  MARIE@Test.COM  ');

      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'marie@test.com' },
        }),
      );
    });

    it('should accept COMPLETED orders', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        status: 'COMPLETED',
        amount: 2900,
      });

      const result = await service.findUserWithPaidOrder('marie@test.com');
      expect(result).toBeTruthy();
    });

    it('should reject PENDING orders with amount > 0 (awaiting webhook)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'PENDING', amount: 2900, createdAt: new Date() },
      ]);

      const result = await service.findUserWithPaidOrder('marie@test.com');
      expect(result).toBeNull();
    });

    it('should reject PENDING orders with amount 0 (no free bypass)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order.findFirst.mockResolvedValue(null);
      prisma.order.findMany.mockResolvedValue([
        { id: 'order-1', status: 'PENDING', amount: 0, createdAt: new Date() },
      ]);

      const result = await service.findUserWithPaidOrder('marie@test.com');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // upsertByEmail / createIfNotExists
  // =========================================================================

  describe('upsertByEmail', () => {
    it('should create user with normalized email when missing', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(mockUser);

      await service.upsertByEmail('MARIE@Test.com', 'Marie', 'Dubois', '+33612345678');

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'marie@test.com', firstName: 'Marie' }),
        }),
      );
    });

    it('should not overwrite existing user PII', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.upsertByEmail('marie@test.com', 'Hacker', 'Name', '+100');

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  // =========================================================================
  // getUserProfile
  // =========================================================================

  describe('getUserProfile', () => {
    it('should return user with profile and stats', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.order.count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);

      const result = await service.getUserProfile('user-1');

      expect(result).toBeTruthy();
      expect(result!.user.email).toBe('marie@test.com');
      expect(result!.profile).toBeTruthy();
      expect(result!.stats).toEqual({ totalOrders: 3, completedOrders: 2 });
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.getUserProfile('nonexistent');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getCompletedOrders
  // =========================================================================

  describe('getCompletedOrders', () => {
    it('should return orders in success states sorted by date desc', async () => {
      const orders = [
        {
          id: 'o1',
          orderNumber: 'LU260401001',
          status: 'COMPLETED',
          deliveredAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'o2',
          orderNumber: 'LU260401002',
          status: 'PROCESSING',
          deliveredAt: null,
          createdAt: new Date(),
        },
      ];
      prisma.order.findMany.mockResolvedValue(orders);

      const result = await service.getCompletedOrders('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId: 'user-1',
            status: { in: ['COMPLETED', 'AWAITING_VALIDATION', 'PROCESSING', 'PAID'] },
          },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });

  // =========================================================================
  // findByEmail
  // =========================================================================

  describe('findByEmail', () => {
    it('should return user with profile when found', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findByEmail('marie@test.com');

      expect(result).toBeTruthy();
      expect(prisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'marie@test.com' },
          include: { profile: true },
        }),
      );
    });

    it('should return null when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@test.com');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // onboarding persistence and consent
  // =========================================================================

  describe('updateProfile', () => {
    it('records versioned consent and completes the server-side draft', async () => {
      prisma.userProfile.upsert.mockResolvedValue(mockUser.profile);
      prisma.consentRecord.upsert.mockResolvedValue({ id: 'consent-1' });
      prisma.onboardingProgress.upsert.mockResolvedValue({ id: 'progress-1' });
      prisma.$transaction.mockResolvedValue([]);

      await service.updateProfile('user-1', {
        birthDate: '1990-06-15',
        facePhotoUrl: 's3://onboarding/user-1/face-1.jpg',
        palmPhotoUrl: 's3://onboarding/user-1/palm-1.jpg',
        profileCompleted: true,
        consent: { accepted: true, version: '2026-07-16' },
      });

      expect(prisma.consentRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId_purpose_version: expect.objectContaining({ userId: 'user-1' }),
          }),
        }),
      );
      expect(prisma.onboardingProgress.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('rejects Base64 photos before they can reach persistent storage', async () => {
      await expect(
        service.updateProfile('user-1', {
          facePhotoUrl: 'data:image/jpeg;base64,not-allowed',
        }),
      ).rejects.toThrow('stockage privé Lumira');
    });
  });

  describe('saveOnboardingProgress', () => {
    it('refuses Base64 previews in the server-side draft', async () => {
      await expect(
        service.saveOnboardingProgress('user-1', {
          currentStep: 3,
          data: { facePhoto: 'data:image/jpeg;base64,not-allowed' },
        }),
      ).rejects.toThrow('Base64');
    });
  });
});
