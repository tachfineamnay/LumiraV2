import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PrismaService } from '../../prisma/prisma.service';

// =========================================================================
// Helper to create mock ExecutionContext
// =========================================================================

function createMockExecutionContext(user: Record<string, any> | null = null): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => ({ user }),
        }),
        getHandler: () => jest.fn(),
        getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
}

// =========================================================================
// SubscriptionGuard
// =========================================================================

describe('SubscriptionGuard', () => {
    let guard: SubscriptionGuard;
    let prisma: Record<string, any>;

    beforeEach(async () => {
        prisma = {
            subscription: {
                findUnique: jest.fn(),
            },
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SubscriptionGuard,
                { provide: PrismaService, useValue: prisma },
            ],
        }).compile();

        guard = module.get<SubscriptionGuard>(SubscriptionGuard);
    });

    it('should allow access for ACTIVE subscription', async () => {
        const context = createMockExecutionContext({ id: 'user-1' });
        prisma.subscription.findUnique.mockResolvedValue({ status: 'ACTIVE' });

        const result = await guard.canActivate(context);

        expect(result).toBe(true);
    });

    it('should throw ForbiddenException for no subscription', async () => {
        const context = createMockExecutionContext({ id: 'user-1' });
        prisma.subscription.findUnique.mockResolvedValue(null);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for CANCELED subscription', async () => {
        const context = createMockExecutionContext({ id: 'user-1' });
        prisma.subscription.findUnique.mockResolvedValue({ status: 'CANCELED' });

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for PAST_DUE subscription', async () => {
        const context = createMockExecutionContext({ id: 'user-1' });
        prisma.subscription.findUnique.mockResolvedValue({ status: 'PAST_DUE' });

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException for EXPIRED subscription', async () => {
        const context = createMockExecutionContext({ id: 'user-1' });
        prisma.subscription.findUnique.mockResolvedValue({ status: 'EXPIRED' });

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when no user on request', async () => {
        const context = createMockExecutionContext(null);

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user has no id', async () => {
        const context = createMockExecutionContext({ email: 'test@test.com' }); // no id

        await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
});

// =========================================================================
// RolesGuard
// =========================================================================

describe('RolesGuard', () => {
    let guard: RolesGuard;
    let reflector: Reflector;

    beforeEach(async () => {
        reflector = {
            getAllAndOverride: jest.fn(),
        } as unknown as Reflector;

        guard = new RolesGuard(reflector);
    });

    it('should allow access when no roles are required', () => {
        (reflector.getAllAndOverride as jest.Mock).mockReturnValue(null);
        const context = createMockExecutionContext({ role: 'CLIENT' });

        expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access when user role matches required role', () => {
        (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['CLIENT']);
        const context = createMockExecutionContext({ role: 'CLIENT' });

        expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow ADMIN access to EXPERT-required routes', () => {
        (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['EXPERT', 'ADMIN']);
        const context = createMockExecutionContext({ role: 'ADMIN' });

        expect(guard.canActivate(context)).toBe(true);
    });

    it('should deny access when role does not match', () => {
        (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['ADMIN']);
        const context = createMockExecutionContext({ role: 'CLIENT' });

        expect(guard.canActivate(context)).toBe(false);
    });

    it('should deny CLIENT access to EXPERT-only routes', () => {
        (reflector.getAllAndOverride as jest.Mock).mockReturnValue(['EXPERT']);
        const context = createMockExecutionContext({ role: 'CLIENT' });

        expect(guard.canActivate(context)).toBe(false);
    });
});
