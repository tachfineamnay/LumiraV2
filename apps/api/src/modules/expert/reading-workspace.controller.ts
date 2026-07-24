import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Expert } from '@prisma/client';
import type { Response } from 'express';
import { CurrentExpert } from './decorators';
import {
  GenerateWorkspaceReadingDto,
  PatchReadingBlockDto,
  ReopenStructuredReadingDto,
  RestoreReadingBlockDto,
  ReviseReadingBlockDto,
  SaveStructuredReadingDto,
  SealStructuredReadingDto,
} from './dto/reading-workspace.dto';
import { ExpertAuthGuard, RolesGuard } from './guards';
import { ReadingWorkspaceService } from './reading-workspace.service';

@Controller('expert/orders/:id/reading')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ReadingWorkspaceController {
  constructor(private readonly workspace: ReadingWorkspaceService) {}

  @Get()
  async getWorkspace(@Param('id') orderId: string) {
    return this.workspace.getWorkspace(orderId);
  }

  @Post('generate')
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @Param('id') orderId: string,
    @Body() dto: GenerateWorkspaceReadingDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.generate(orderId, dto, expert);
  }

  @Patch('draft')
  async saveDraft(
    @Param('id') orderId: string,
    @Body() dto: SaveStructuredReadingDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.saveStructuredDraft(orderId, dto, expert);
  }

  @Patch('blocks/:blockId')
  async patchBlock(
    @Param('id') orderId: string,
    @Param('blockId') blockId: string,
    @Body() dto: PatchReadingBlockDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.patchBlock(orderId, blockId, dto, expert);
  }

  @Post('blocks/:blockId/revise')
  async reviseBlock(
    @Param('id') orderId: string,
    @Param('blockId') blockId: string,
    @Body() dto: ReviseReadingBlockDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.reviseBlock(orderId, blockId, dto, expert);
  }

  @Post('blocks/:blockId/restore')
  async restoreBlock(
    @Param('id') orderId: string,
    @Param('blockId') blockId: string,
    @Body() dto: RestoreReadingBlockDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.restoreBlock(orderId, blockId, dto, expert);
  }

  @Post('quality/repair')
  async repairSafeIssues(@Param('id') orderId: string, @CurrentExpert() expert: Expert) {
    return this.workspace.repairSafeIssues(orderId, expert);
  }

  @Post('preview')
  async preview(@Param('id') orderId: string, @Res({ passthrough: true }) res: Response) {
    const preview = await this.workspace.previewPdf(orderId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${preview.filename}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(preview.buffer);
  }

  @Post('seal')
  async seal(
    @Param('id') orderId: string,
    @Body() dto: SealStructuredReadingDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.seal(orderId, dto, expert);
  }

  @Post('reopen')
  async reopen(
    @Param('id') orderId: string,
    @Body() dto: ReopenStructuredReadingDto,
    @CurrentExpert() expert: Expert,
  ) {
    return this.workspace.reopen(orderId, dto, expert);
  }

  @Get('history')
  async getHistory(@Param('id') orderId: string) {
    return this.workspace.getHistory(orderId);
  }
}
