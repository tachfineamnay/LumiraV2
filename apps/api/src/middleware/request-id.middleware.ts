import { randomUUID } from 'crypto';
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
    private readonly logger = new Logger('HTTP');

    use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
        const requestId = (req.headers['x-request-id'] as string) || randomUUID();
        req.requestId = requestId;
        res.setHeader('X-Request-Id', requestId);

        const started = Date.now();
        res.on('finish', () => {
            const duration = Date.now() - started;
            this.logger.log(
                `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [${requestId}]`,
            );
        });

        next();
    }
}
