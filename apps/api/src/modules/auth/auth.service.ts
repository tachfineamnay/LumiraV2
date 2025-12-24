import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usersService: UsersService,
        private jwtService: JwtService,
    ) { }

    async validateExpert(email: string, pass: string): Promise<any> {
        const expert = await this.usersService.findExpertByEmail(email);
        if (expert && (await bcrypt.compare(pass, expert.password))) {
            const { password, ...result } = expert;
            return result;
        }
        return null;
    }

    async validateClient(email: string): Promise<any> {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    async login(user: any, type: 'client' | 'expert') {
        const payload = {
            email: user.email,
            sub: user.id,
            role: type === 'expert' ? user.role : 'CLIENT'
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                email: user.email,
                name: type === 'expert' ? user.name : `${user.firstName} ${user.lastName}`,
                role: payload.role,
            }
        };
    }

    async getMe(user: any) {
        if (user.role === 'CLIENT') {
            const client = await this.usersService.findByEmail(user.email);
            const entitlements = await this.usersService.getEntitlements(user.userId);
            return { ...client, entitlements };
        } else {
            const expert = await this.usersService.findExpertByEmail(user.email);
            return expert;
        }
    }
}
