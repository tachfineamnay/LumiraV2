import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcryptjs';
import { User, Expert } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../notifications/email.service';

type ExpertWithoutPassword = Omit<Expert, 'password'>;
type JwtExpiration = JwtSignOptions['expiresIn'];

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  private get sanctuaireTokenExpiry(): string {
    return this.configService.get<string>('JWT_EXPIRATION', '30d');
  }

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
      role: type === 'expert' ? (user as ExpertWithoutPassword).role : 'CLIENT',
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name:
          type === 'expert'
            ? (user as Expert).name
            : `${(user as User).firstName} ${(user as User).lastName}`,
        role: payload.role,
      },
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

  private async issueSanctuaireSession(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'phone'>,
  ): Promise<{
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
    const entitlements = await this.usersService.getEntitlements(user.id);

    // Generate JWT with 30-day expiration
    const payload = {
      email: user.email,
      sub: user.id,
      userId: user.id,
      role: 'CLIENT',
      level: entitlements.highestLevel,
    };

    const token = this.jwtService.sign(payload, {
      expiresIn: this.sanctuaireTokenExpiry as JwtExpiration,
    });

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

  /**
   * Server-only handoff for an already verified Stripe payment. This method
   * must not be exposed from an HTTP controller: email ownership is proven
   * by Stripe here, and by a magic link everywhere else.
   */
  async issueSanctuaireSessionForVerifiedPayment(email: string) {
    const user = await this.usersService.findUserWithPaidOrder(email);
    if (!user) {
      throw new UnauthorizedException('Aucun accès Sanctuaire actif pour cette commande');
    }
    return this.issueSanctuaireSession(user);
  }

  /**
   * Request a single-use magic link for a paid Sanctuaire account.
   * The response is deliberately identical for unknown and unpaid addresses
   * so this endpoint cannot be used to enumerate customers.
   */
  async requestSanctuaireMagicLink(email: string): Promise<{ success: true; message: string }> {
    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.usersService.findUserWithPaidOrder(normalizedEmail);
    const successResponse = {
      success: true as const,
      message: 'Si un accès existe pour cette adresse, un lien de connexion vient d’être envoyé.',
    };

    if (!user) {
      return successResponse;
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresMinutes = 15;
    const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000);

    await this.prisma.sanctuaireLoginToken.deleteMany({
      where: {
        userId: user.id,
        OR: [{ expiresAt: { lt: new Date() } }, { consumedAt: null }],
      },
    });
    await this.prisma.sanctuaireLoginToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    const loginUrl = new URL('/sanctuaire/login', webUrl);
    loginUrl.searchParams.set('token', rawToken);

    try {
      await this.emailService.sendOrThrow({
        to: user.email,
        subject: 'Votre lien sécurisé pour le Sanctuaire Oracle',
        template: 'sanctuaire-login',
        context: {
          firstName: user.firstName,
          loginUrl: loginUrl.toString(),
          expiresMinutes,
        },
      });
    } catch (error) {
      await this.prisma.sanctuaireLoginToken.deleteMany({ where: { tokenHash } });
      throw error;
    }

    return successResponse;
  }

  /** Consume a magic link exactly once and issue the regular client JWT. */
  async consumeSanctuaireMagicLink(rawToken: string) {
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();
    const result = await this.prisma.sanctuaireLoginToken.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });

    if (result.count !== 1) {
      throw new UnauthorizedException('Ce lien de connexion est invalide ou a expiré');
    }

    const token = await this.prisma.sanctuaireLoginToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
    if (!token?.user) {
      throw new UnauthorizedException('Ce lien de connexion est invalide ou a expiré');
    }

    return this.issueSanctuaireSession(token.user);
  }

  /**
   * Pre-register a Sanctuaire client before Stripe checkout.
   * Creates the user if missing; never issues a JWT (payment proves ownership).
   * Existing users are returned as-is without PII overwrite.
   */
  async registerSanctuaire(dto: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<{
    success: true;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
    };
  }> {
    const user = await this.usersService.createIfNotExists(
      dto.email,
      dto.firstName,
      dto.lastName,
      dto.phone,
    );

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    };
  }
}
