import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let jwtService: jest.Mocked<Partial<JwtService>>;
  const prisma = {
    sanctuaireLoginToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  const emailService = { sendOrThrow: jest.fn() };

  const mockUser = {
    id: 'user-1',
    email: 'marie@test.com',
    firstName: 'Marie',
    lastName: 'Dubois',
    phone: '+33612345678',
    stripeCustomerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    profile: null,
  };

  const mockExpert = {
    id: 'expert-1',
    email: 'expert@lumira.fr',
    name: 'Expert Lumira',
    password: '$2b$12$hashedpassword',
    role: 'EXPERT' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    usersService = {
      findByEmail: jest.fn(),
      findExpertByEmail: jest.fn(),
      findUserWithPaidOrder: jest.fn(),
      getEntitlements: jest.fn(),
      upsertByEmail: jest.fn(),
      createIfNotExists: jest.fn(),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const configService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'JWT_EXPIRATION') return '30d';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('Sanctuaire magic links', () => {
    it('returns the same generic response for an unknown email without sending mail', async () => {
      usersService.findUserWithPaidOrder!.mockResolvedValue(null);

      const result = await service.requestSanctuaireMagicLink('unknown@test.com');

      expect(result.success).toBe(true);
      expect(emailService.sendOrThrow).not.toHaveBeenCalled();
      expect(prisma.sanctuaireLoginToken.create).not.toHaveBeenCalled();
    });

    it('hashes and emails a single-use link for a paid user', async () => {
      usersService.findUserWithPaidOrder!.mockResolvedValue(mockUser as any);
      prisma.sanctuaireLoginToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.sanctuaireLoginToken.create.mockResolvedValue({ id: 'link-1' });
      emailService.sendOrThrow.mockResolvedValue(undefined);

      await service.requestSanctuaireMagicLink('marie@test.com');

      expect(prisma.sanctuaireLoginToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1', tokenHash: expect.any(String) }),
        }),
      );
      expect(emailService.sendOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'marie@test.com',
          template: 'sanctuaire-login',
          context: expect.objectContaining({
            loginUrl: expect.stringContaining('/sanctuaire/login?token='),
          }),
        }),
      );
    });

    it('consumes a valid link once before issuing the session', async () => {
      prisma.sanctuaireLoginToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.sanctuaireLoginToken.findUnique.mockResolvedValue({ user: mockUser });
      usersService.getEntitlements!.mockResolvedValue({
        capabilities: [],
        products: [],
        highestLevel: 1,
        orderCount: 1,
      });

      const result = await service.consumeSanctuaireMagicLink('single-use-token');

      expect(result.token).toBe('mock-jwt-token');
      expect(prisma.sanctuaireLoginToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { consumedAt: expect.any(Date) } }),
      );
    });
  });

  // =========================================================================
  // verified payment session handoff
  // =========================================================================

  describe('issueSanctuaireSessionForVerifiedPayment', () => {
    it('should return token and user for email with paid order', async () => {
      usersService.findUserWithPaidOrder!.mockResolvedValue(mockUser as any);
      usersService.getEntitlements!.mockResolvedValue({
        capabilities: ['content.basic'],
        products: ['subscription'],
        highestLevel: 4,
        orderCount: 1,
      });

      const result = await service.issueSanctuaireSessionForVerifiedPayment('marie@test.com');

      expect(result.success).toBe(true);
      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('marie@test.com');
      expect(result.user.firstName).toBe('Marie');
      expect(result.user.level).toBe(4);
    });

    it('should throw UnauthorizedException if no user with paid order', async () => {
      usersService.findUserWithPaidOrder!.mockResolvedValue(null);

      await expect(
        service.issueSanctuaireSessionForVerifiedPayment('unknown@test.com'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should sign JWT with 30-day expiration', async () => {
      usersService.findUserWithPaidOrder!.mockResolvedValue(mockUser as any);
      usersService.getEntitlements!.mockResolvedValue({
        capabilities: [],
        products: [],
        highestLevel: 0,
        orderCount: 0,
      });

      await service.issueSanctuaireSessionForVerifiedPayment('marie@test.com');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'marie@test.com',
          sub: 'user-1',
          userId: 'user-1',
          role: 'CLIENT',
        }),
        { expiresIn: '30d' },
      );
    });

    it('should include highestLevel in JWT payload', async () => {
      usersService.findUserWithPaidOrder!.mockResolvedValue(mockUser as any);
      usersService.getEntitlements!.mockResolvedValue({
        capabilities: [],
        products: ['subscription'],
        highestLevel: 4,
        orderCount: 1,
      });

      await service.issueSanctuaireSessionForVerifiedPayment('marie@test.com');

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ level: 4 }),
        expect.any(Object),
      );
    });
  });

  // =========================================================================
  // registerSanctuaire
  // =========================================================================

  describe('registerSanctuaire', () => {
    it('should create user without issuing a JWT', async () => {
      usersService.createIfNotExists = jest.fn().mockResolvedValue(mockUser as any);

      const result = await service.registerSanctuaire({
        email: 'marie@test.com',
        firstName: 'Marie',
        lastName: 'Dubois',
      });

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('marie@test.com');
      expect((result as any).token).toBeUndefined();
      expect(jwtService.sign).not.toHaveBeenCalled();
    });

    it('should create-if-missing by email', async () => {
      usersService.createIfNotExists = jest.fn().mockResolvedValue(mockUser as any);

      await service.registerSanctuaire({
        email: 'marie@test.com',
        firstName: 'Marie',
        lastName: 'Dubois',
        phone: '+33612345678',
      });

      expect(usersService.createIfNotExists).toHaveBeenCalledWith(
        'marie@test.com',
        'Marie',
        'Dubois',
        '+33612345678',
      );
    });
  });

  // =========================================================================
  // validateClient
  // =========================================================================

  describe('validateClient', () => {
    it('should return user when found by email', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);

      const result = await service.validateClient('marie@test.com');
      expect(result.email).toBe('marie@test.com');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail!.mockResolvedValue(null);

      await expect(service.validateClient('nobody@test.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // =========================================================================
  // login
  // =========================================================================

  describe('login', () => {
    it('should return access_token for client login', async () => {
      const result = await service.login(mockUser as any, 'client');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.role).toBe('CLIENT');
    });

    it('should return access_token for expert login', async () => {
      const { password: _, ...expertWithoutPassword } = mockExpert;
      const result = await service.login(expertWithoutPassword as any, 'expert');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.role).toBe('EXPERT');
    });
  });

  // =========================================================================
  // getMe
  // =========================================================================

  describe('getMe', () => {
    it('should return client data with entitlements for CLIENT role', async () => {
      usersService.findByEmail!.mockResolvedValue(mockUser as any);
      usersService.getEntitlements!.mockResolvedValue({
        capabilities: ['content.basic'],
        products: ['subscription'],
        highestLevel: 4,
        orderCount: 1,
      });

      const result = await service.getMe({
        email: 'marie@test.com',
        role: 'CLIENT',
        userId: 'user-1',
      });

      expect(usersService.findByEmail).toHaveBeenCalledWith('marie@test.com');
      expect(usersService.getEntitlements).toHaveBeenCalledWith('user-1');
      expect(result).toHaveProperty('entitlements');
    });

    it('should return expert data for non-CLIENT role', async () => {
      const { password: _, ...expertWithoutPassword } = mockExpert;
      usersService.findExpertByEmail!.mockResolvedValue(expertWithoutPassword as any);

      const result = await service.getMe({
        email: 'expert@lumira.fr',
        role: 'EXPERT',
        userId: 'expert-1',
      });

      expect(usersService.findExpertByEmail).toHaveBeenCalledWith('expert@lumira.fr');
    });
  });
});
