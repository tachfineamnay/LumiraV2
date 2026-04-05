import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
    let service: AuthService;
    let usersService: jest.Mocked<Partial<UsersService>>;
    let jwtService: jest.Mocked<Partial<JwtService>>;

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
        usersService = {
            findByEmail: jest.fn(),
            findExpertByEmail: jest.fn(),
            findUserWithPaidOrder: jest.fn(),
            getEntitlements: jest.fn(),
            upsertByEmail: jest.fn(),
        };

        jwtService = {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                { provide: UsersService, useValue: usersService },
                { provide: JwtService, useValue: jwtService },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
    });

    // =========================================================================
    // authenticateSanctuaire
    // =========================================================================

    describe('authenticateSanctuaire', () => {
        it('should return token and user for email with paid order', async () => {
            usersService.findUserWithPaidOrder!.mockResolvedValue(mockUser as any);
            usersService.getEntitlements!.mockResolvedValue({
                capabilities: ['content.basic'],
                products: ['subscription'],
                highestLevel: 4,
                orderCount: 1,
            });

            const result = await service.authenticateSanctuaire('marie@test.com');

            expect(result.success).toBe(true);
            expect(result.token).toBe('mock-jwt-token');
            expect(result.user.email).toBe('marie@test.com');
            expect(result.user.firstName).toBe('Marie');
            expect(result.user.level).toBe(4);
        });

        it('should throw UnauthorizedException if no user with paid order', async () => {
            usersService.findUserWithPaidOrder!.mockResolvedValue(null);

            await expect(service.authenticateSanctuaire('unknown@test.com'))
                .rejects
                .toThrow(UnauthorizedException);
        });

        it('should sign JWT with 30-day expiration', async () => {
            usersService.findUserWithPaidOrder!.mockResolvedValue(mockUser as any);
            usersService.getEntitlements!.mockResolvedValue({
                capabilities: [],
                products: [],
                highestLevel: 0,
                orderCount: 0,
            });

            await service.authenticateSanctuaire('marie@test.com');

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

            await service.authenticateSanctuaire('marie@test.com');

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
        it('should upsert user and return JWT', async () => {
            usersService.upsertByEmail!.mockResolvedValue(mockUser as any);

            const result = await service.registerSanctuaire({
                email: 'marie@test.com',
                firstName: 'Marie',
                lastName: 'Dubois',
            });

            expect(result.success).toBe(true);
            expect(result.token).toBeDefined();
            expect(result.access_token).toBeDefined();
            expect(result.user.email).toBe('marie@test.com');
        });

        it('should normalize and upsert by email', async () => {
            usersService.upsertByEmail!.mockResolvedValue(mockUser as any);

            await service.registerSanctuaire({
                email: 'marie@test.com',
                firstName: 'Marie',
                lastName: 'Dubois',
                phone: '+33612345678',
            });

            expect(usersService.upsertByEmail).toHaveBeenCalledWith(
                'marie@test.com',
                'Marie',
                'Dubois',
                '+33612345678',
            );
        });

        it('should sign JWT with level 0 for pre-checkout users', async () => {
            usersService.upsertByEmail!.mockResolvedValue(mockUser as any);

            await service.registerSanctuaire({
                email: 'marie@test.com',
                firstName: 'Marie',
                lastName: 'Dubois',
            });

            expect(jwtService.sign).toHaveBeenCalledWith(
                expect.objectContaining({ level: 0, role: 'CLIENT' }),
                { expiresIn: '30d' },
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

            await expect(service.validateClient('nobody@test.com'))
                .rejects
                .toThrow(UnauthorizedException);
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

            const result = await service.getMe({ email: 'marie@test.com', role: 'CLIENT', userId: 'user-1' });

            expect(usersService.findByEmail).toHaveBeenCalledWith('marie@test.com');
            expect(usersService.getEntitlements).toHaveBeenCalledWith('user-1');
            expect(result).toHaveProperty('entitlements');
        });

        it('should return expert data for non-CLIENT role', async () => {
            const { password: _, ...expertWithoutPassword } = mockExpert;
            usersService.findExpertByEmail!.mockResolvedValue(expertWithoutPassword as any);

            const result = await service.getMe({ email: 'expert@lumira.fr', role: 'EXPERT', userId: 'expert-1' });

            expect(usersService.findExpertByEmail).toHaveBeenCalledWith('expert@lumira.fr');
        });
    });
});
