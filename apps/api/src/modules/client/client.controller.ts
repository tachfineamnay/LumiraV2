import {
    Controller,
    Get,
    Post,
    Param,
    Request,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ClientService } from './client.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Throttle } from '@nestjs/throttler';

/**
 * ClientController - Sanctuaire API endpoints
 * 
 * Provides endpoints for the user's sanctuary (sanctuaire) including:
 * - Spiritual path journey data
 * - User profile with reading data
 * - Completed readings list
 * - Reading content access
 */
@Controller('client')
@UseGuards(JwtAuthGuard)
export class ClientController {
    constructor(private readonly clientService: ClientService) { }

    /**
     * GET /api/client/spiritual-path
     * Returns the user's spiritual path journey with all steps
     */
    @Get('spiritual-path')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getSpiritualPath(@Request() req: { user: { userId: string } }) {
        const path = await this.clientService.getSpiritualPath(req.user.userId);
        
        // Return empty structure if no path exists yet
        if (!path) {
            return {
                exists: false,
                message: 'Votre parcours spirituel sera créé après votre première lecture.',
            };
        }

        return {
            exists: true,
            ...path,
        };
    }

    /**
     * POST /api/client/spiritual-path/steps/:stepId/complete
     * Mark a step as completed
     */
    @Post('spiritual-path/steps/:stepId/complete')
    @HttpCode(HttpStatus.OK)
    async completeStep(
        @Request() req: { user: { userId: string } },
        @Param('stepId') stepId: string,
    ) {
        const step = await this.clientService.completeStep(req.user.userId, stepId);
        return {
            success: true,
            step,
        };
    }

    /**
     * GET /api/client/profile
     * Returns the user's profile with their latest reading summary
     */
    @Get('profile')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getProfile(@Request() req: { user: { userId: string } }) {
        return this.clientService.getClientProfile(req.user.userId);
    }

    /**
     * GET /api/client/readings
     * Returns all readings for the user (completed + in progress)
     */
    @Get('readings')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getReadings(@Request() req: { user: { userId: string } }) {
        const result = await this.clientService.getCompletedReadings(req.user.userId);
        return {
            readings: result.readings,
            pending: result.pending,
            totalCompleted: result.readings.length,
            totalPending: result.pending.length,
        };
    }

    /**
     * GET /api/client/readings/:orderId
     * Returns the full content of a specific reading
     */
    @Get('readings/:orderId')
    @Throttle({ default: { limit: 30, ttl: 60000 } })
    async getReadingContent(
        @Request() req: { user: { userId: string } },
        @Param('orderId') orderId: string,
    ) {
        return this.clientService.getReadingContent(req.user.userId, orderId);
    }
}
