import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Request } from 'express';

@Injectable()
export class HmacSignatureGuard implements CanActivate {
    private readonly logger = new Logger(HmacSignatureGuard.name);
    private readonly nonceCache = new Map<string, number>();

    constructor(private configService: ConfigService) {
        // Periodically clean up nonce cache
        setInterval(() => this.cleanupNonces(), 3600000); // Every hour
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request & { rawBody: Buffer }>();
        const signature = request.headers['x-webhook-signature'] as string;
        const timestamp = request.headers['x-webhook-timestamp'] as string;
        const nonce = request.headers['x-webhook-nonce'] as string;

        if (!signature || !timestamp || !nonce) {
            throw new UnauthorizedException('Missing security headers');
        }

        // 1. Verify Timestamp (max 5 minutes skew)
        const now = Math.floor(Date.now() / 1000);
        if (Math.abs(now - parseInt(timestamp)) > 300) {
            throw new UnauthorizedException('Timestamp expired');
        }

        // 2. Replay Protection
        if (this.nonceCache.has(nonce)) {
            throw new UnauthorizedException('Replay detected');
        }

        // 3. Verify HMAC
        const secret = this.configService.get<string>('N8N_WEBHOOK_SECRET');
        if (!secret) {
            this.logger.error('N8N_WEBHOOK_SECRET is not configured');
            throw new UnauthorizedException('Webhook secret not configured');
        }

        const rawBody = request.rawBody?.toString('utf-8') || '';
        const payload = `${timestamp}.${nonce}.${rawBody}`;

        const expectedSig = crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');

        if (signature !== `sha256=${expectedSig}`) {
            this.logger.warn(`Invalid signature attempt. Expected: sha256=${expectedSig.substring(0, 10)}...`);
            throw new UnauthorizedException('Invalid signature');
        }

        // Cache nonce (TTL 1 hour)
        this.nonceCache.set(nonce, Date.now() + 3600000);

        return true;
    }

    private cleanupNonces() {
        const now = Date.now();
        for (const [nonce, expiry] of this.nonceCache.entries()) {
            if (now > expiry) {
                this.nonceCache.delete(nonce);
            }
        }
    }
}
