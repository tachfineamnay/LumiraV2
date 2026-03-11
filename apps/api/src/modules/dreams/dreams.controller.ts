import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Request,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SubscriptionGuard } from '../../guards/subscription.guard';
import { DreamsService } from './dreams.service';
import { CreateDreamDto } from './dto/create-dream.dto';

@Controller('dreams')
@UseGuards(JwtAuthGuard, SubscriptionGuard)
export class DreamsController {
    constructor(private readonly dreamsService: DreamsService) {}

    /**
     * POST /dreams
     * Submit a new dream. Max 2 per day — returns 429 if exceeded.
     */
    @Post()
    @HttpCode(HttpStatus.CREATED)
    async create(@Request() req, @Body() dto: CreateDreamDto) {
        return this.dreamsService.create(req.user.id, dto);
    }

    /**
     * GET /dreams
     * Returns the last 30 days of dreams for the authenticated user.
     */
    @Get()
    async findAll(@Request() req) {
        return this.dreamsService.findAll(req.user.id);
    }

    /**
     * GET /dreams/patterns/analysis
     * Returns pattern analysis across all dreams (requires >= 5 dreams).
     * Must be declared BEFORE /:id to avoid route collision.
     */
    @Get('patterns/analysis')
    async analyzePatterns(@Request() req) {
        return this.dreamsService.analyzePatterns(req.user.id);
    }

    /**
     * GET /dreams/:id
     * Returns a single dream by ID (must belong to the authenticated user).
     */
    @Get(':id')
    async findOne(@Request() req, @Param('id') id: string) {
        return this.dreamsService.findOne(req.user.id, id);
    }
}
