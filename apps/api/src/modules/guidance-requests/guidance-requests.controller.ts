import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentExpert } from '../expert/decorators';
import { ExpertAuthGuard, RolesGuard } from '../expert/guards';
import { GuidanceRequestsService } from './guidance-requests.service';
import {
  GUIDANCE_REQUEST_STATUSES,
  GuidanceRequestCategory,
  GuidanceRequestPriority,
  GuidanceRequestStatus,
} from './guidance-request.types';

type AuthenticatedClientRequest = { user: { id: string } };

@Controller('client/requests')
@UseGuards(JwtAuthGuard)
export class ClientGuidanceRequestsController {
  constructor(private readonly requests: GuidanceRequestsService) {}

  @Get()
  async list(@Request() req: AuthenticatedClientRequest) {
    return { data: await this.requests.listClientRequests(req.user.id) };
  }

  @Post()
  async create(
    @Request() req: AuthenticatedClientRequest,
    @Body()
    body: {
      subject: string;
      content: string;
      category?: GuidanceRequestCategory;
      priority?: GuidanceRequestPriority;
      relatedOrderId?: string;
    },
  ) {
    return this.requests.createClientRequest(req.user.id, body);
  }

  @Get(':id')
  async get(@Request() req: AuthenticatedClientRequest, @Param('id') requestId: string) {
    return this.requests.getClientRequest(req.user.id, requestId);
  }

  @Post(':id/messages')
  async addMessage(
    @Request() req: AuthenticatedClientRequest,
    @Param('id') requestId: string,
    @Body('content') content: string,
  ) {
    return this.requests.addClientMessage(req.user.id, requestId, content);
  }

  @Post(':id/read')
  async markRead(@Request() req: AuthenticatedClientRequest, @Param('id') requestId: string) {
    return this.requests.markClientRead(req.user.id, requestId);
  }
}

@Controller('expert/requests')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ExpertGuidanceRequestsController {
  constructor(private readonly requests: GuidanceRequestsService) {}

  @Get()
  async list(
    @CurrentExpert() expert: Expert,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const normalizedStatus = GUIDANCE_REQUEST_STATUSES.includes(status as GuidanceRequestStatus)
      ? (status as GuidanceRequestStatus)
      : undefined;
    return {
      data: await this.requests.listExpertRequests(expert, {
        status: normalizedStatus,
        assignedTo: assignedTo === 'mine' || assignedTo === 'unassigned' ? assignedTo : undefined,
        unreadOnly: unreadOnly === 'true',
        limit: limit ? Number.parseInt(limit, 10) : undefined,
      }),
    };
  }

  @Get(':id')
  async get(@Param('id') requestId: string) {
    return this.requests.getExpertRequest(requestId);
  }

  @Post(':id/assign')
  async assign(@Param('id') requestId: string, @CurrentExpert() expert: Expert) {
    return this.requests.assignRequest(requestId, expert);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') requestId: string,
    @Body('content') content: string,
    @CurrentExpert() expert: Expert,
  ) {
    return this.requests.addExpertMessage(expert, requestId, content);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') requestId: string,
    @Body('status') status: string,
    @CurrentExpert() expert: Expert,
  ) {
    return this.requests.updateStatus(requestId, status, expert);
  }

  @Post(':id/read')
  async markRead(@Param('id') requestId: string) {
    return this.requests.markExpertRead(requestId);
  }
}
