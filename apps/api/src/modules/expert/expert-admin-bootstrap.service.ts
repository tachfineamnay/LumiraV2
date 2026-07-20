import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpertRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_ADMIN_EMAIL = 'expert@oraclelumira.com';
const SALT_ROUNDS = 12;

@Injectable()
export class ExpertAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ExpertAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = (
      this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL') || DEFAULT_ADMIN_EMAIL
    ).trim().toLowerCase();
    const name = this.config.get<string>('ADMIN_BOOTSTRAP_NAME')?.trim() || 'Grégory Tordjman';
    const rotatePassword =
      (this.config.get<string>('ADMIN_BOOTSTRAP_ROTATE_PASSWORD') || '').trim().toLowerCase() ===
      'true';
    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD')?.trim();

    if (email !== DEFAULT_ADMIN_EMAIL) {
      throw new Error(
        `ADMIN_BOOTSTRAP_EMAIL doit rester ${DEFAULT_ADMIN_EMAIL} pour la V1 à administrateur unique.`,
      );
    }

    const existing = await this.prisma.expert.findUnique({ where: { email } });
    if (!existing && !password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_PASSWORD est obligatoire pour créer le compte administrateur initial.',
      );
    }
    if (rotatePassword && !password) {
      throw new Error(
        'ADMIN_BOOTSTRAP_PASSWORD est obligatoire lorsque ADMIN_BOOTSTRAP_ROTATE_PASSWORD=true.',
      );
    }

    const passwordHash = password && (!existing || rotatePassword)
      ? await bcrypt.hash(password, SALT_ROUNDS)
      : undefined;

    await this.prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.expert.update({
          where: { email },
          data: {
            name,
            role: ExpertRole.ADMIN,
            isActive: true,
            ...(passwordHash ? { password: passwordHash } : {}),
          },
        });
      } else {
        await tx.expert.create({
          data: {
            email,
            name,
            role: ExpertRole.ADMIN,
            isActive: true,
            password: passwordHash!,
          },
        });
      }

      await tx.expert.updateMany({
        where: {
          email: { not: email },
          role: ExpertRole.ADMIN,
          isActive: true,
        },
        data: { isActive: false },
      });
    });

    this.logger.log(
      `Canonical Desk admin ready: ${email}${passwordHash ? ' (password rotated)' : ''}`,
    );
  }
}
