import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { User, Expert } from '@prisma/client';

type ExpertWithoutPassword = Omit<Expert, 'password'>;

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateExpert(email: string, pass: string): Promise<ExpertWithoutPassword | null> {
        const expert = await this.usersService.findExpertByEmail(email);
        if (expert && (await bcrypt.compare(pass, expert.password))) {
            const { password: _unused, ...result } = expert;
            void _unused;
            return result;
        }
        return null;
    }

    async validateClient(email: string): Promise<User> {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    async login(user: User | ExpertWithoutPassword, type: 'client' | 'expert') {
        const payload = {
            email: user.email,
            sub: user.id,
            role: type === 'expert' ? (user as ExpertWithoutPassword).role : 'CLIENT'
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: type === 'expert' ? (user as Expert).name : `${(user as User).firstName} ${(user as User).lastName}`,
                role: payload.role,
            }
        };
    }

    async getMe(user: { email: string; role: string; userId: string }) {
        if (user.role === 'CLIENT') {
            const client = await this.usersService.findByEmail(user.email);
            const entitlements = await this.usersService.getEntitlements(user.userId);
            return { ...client, entitlements };
        } else {
            const expert = await this.usersService.findExpertByEmail(user.email);
            return expert;
        }
    }

    /**
     * Authenticate a Sanctuaire client using only their email.
     * Only succeeds if the email is associated with a paid order.
     * Returns a 30-day JWT token.
     */
    async authenticateSanctuaire(email: string): Promise<{
        success: true;
        token: string;
        user: {
            id: string;
            email: string;
            firstName: string;
            lastName: string;
            phone: string | null;
            level: number;
        };
    }> {
        // Find user with at least one paid order
        const user = await this.usersService.findUserWithPaidOrder(email);

        if (!user) {
            throw new UnauthorizedException('Aucune commande trouvée pour cet email');
        }

        // Get user's entitlements to determine level
        const entitlements = await this.usersService.getEntitlements(user.id);

        // Generate JWT with 30-day expiration
        const payload = {
            email: user.email,
            sub: user.id,
            userId: user.id,
            role: 'CLIENT',
            level: entitlements.highestLevel,
        };

        const token = this.jwtService.sign(payload, { expiresIn: '30d' });

        return {
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                level: entitlements.highestLevel,
            },
        };
    }
}
