import {
    Controller,
    Get,
    Post,
    Put,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ExpertService } from './expert.service';
import { AdminSettingsService, ModelConfig } from './admin-settings.service';
import { AudioGenerationService } from '../../services/factory/AudioGenerationService';
import { ExpertAuthGuard, RolesGuard } from './guards';
import { Expert } from '@prisma/client';
import { CurrentExpert, Public, Roles } from './decorators';
import {
    LoginExpertDto,
    RegisterExpertDto,
    ValidateContentDto,
    ProcessOrderDto,
    UpdateClientDto,
    PaginationDto,
    CreateClientDto,
    UpdateClientStatusDto,
    RefineContentDto,
    FinalizeOrderDto,
    ChatOrderDto,
    ClientsQueryDto,
} from './dto';

@Controller('expert')
@UseGuards(ExpertAuthGuard, RolesGuard)
export class ExpertController {
    constructor(
        private readonly expertService: ExpertService,
        private readonly adminSettingsService: AdminSettingsService,
        private readonly audioGenerationService: AudioGenerationService,
    ) { }

    // ========================
    // TEST AUDIO (temporary)
    // ========================

    @Post('test-audio/:orderId')
    @Roles('ADMIN')
    async testAudioGeneration(@Param('orderId') orderId: string) {
        await this.audioGenerationService.generateAllAudio(orderId);
        return { message: `Audio generation triggered for order ${orderId}` };
    }

    // ========================
    // AUTHENTICATION
    // ========================

    @Post('login')
    @Public()
    @Throttle({ default: { limit: 10, ttl: 900000 } }) // 10 requests per 15 minutes
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginExpertDto) {
        return this.expertService.login(dto);
    }

    @Post('register')
    @Roles('ADMIN')
    async register(@Body() dto: RegisterExpertDto) {
        return this.expertService.register(dto);
    }

    @Get('verify')
    @SkipThrottle()
    async verify(@CurrentExpert() expert: Expert) {
        return { valid: true, expert: { id: expert.id, email: expert.email, role: expert.role } };
    }

    @Post('refresh')
    @Public()
    @HttpCode(HttpStatus.OK)
    async refresh(@Body('refreshToken') refreshToken: string) {
        return this.expertService.refreshToken(refreshToken);
    }

    @Get('profile')
    async getProfile(@CurrentExpert() expert: Expert) {
        return this.expertService.getProfile(expert.id);
    }

    @Get('activity')
    @SkipThrottle()
    async getActivity(@Query('limit') limit?: string) {
        const parsedLimit = Math.min(Math.max(parseInt(limit || '10', 10) || 10, 1), 50);
        return this.expertService.getActivity(parsedLimit);
    }

    // ========================
    // ORDERS
    // ========================

    @Get('orders')
    @SkipThrottle()
    async getOrders(@Query() query: PaginationDto) {
        return this.expertService.getPendingOrders(query);
    }

    @Get('orders/pending')
    @SkipThrottle()
    async getPendingOrders(@Query() query: PaginationDto, @Query('since') since?: string) {
        return this.expertService.getPendingOrders({ ...query, since });
    }

    @Get('orders/paid')
    @SkipThrottle()
    async getPaidOrders(@Query() query: PaginationDto) {
        return this.expertService.getPaidOrders(query);
    }

    @Get('orders/processing')
    @SkipThrottle()
    async getProcessingOrders(@Query() query: PaginationDto) {
        return this.expertService.getProcessingOrders(query);
    }

    @Get('orders/validation')
    @SkipThrottle()
    async getValidationQueue(@Query() query: PaginationDto) {
        return this.expertService.getValidationQueue(query);
    }

    @Get('orders/history')
    @SkipThrottle()
    async getOrderHistory(@Query() query: PaginationDto) {
        return this.expertService.getOrderHistory(query);
    }

    @Get('orders/:id')
    @SkipThrottle() // Polling endpoint - skip rate limiting for generation status checks
    async getOrderById(@Param('id') id: string) {
        return this.expertService.getOrderById(id);
    }

    @Post('orders/:id/assign')
    async assignOrder(@Param('id') id: string, @CurrentExpert() expert: Expert) {
        return this.expertService.assignOrder(id, expert.id);
    }

    @Delete('orders/:id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOrder(@Param('id') id: string) {
        await this.expertService.deleteOrder(id);
    }

    // ========================
    // ORDER PROCESSING
    // ========================

    @Post('process-order')
    async processOrder(@Body() dto: ProcessOrderDto, @CurrentExpert() expert: Expert) {
        return this.expertService.processOrder(dto, expert);
    }

    @Post('validate-content')
    async validateContent(@Body() dto: ValidateContentDto, @CurrentExpert() expert: Expert) {
        return this.expertService.validateContent(dto, expert);
    }

    @Post('regenerate')
    async regenerateLecture(@Body('orderId') orderId: string, @CurrentExpert() expert: Expert) {
        return this.expertService.regenerateLecture(orderId, expert);
    }

    /**
     * Triggers AI-powered reading generation for an order.
     * Uses DigitalSoulService to orchestrate: AI → Database → PDF → S3.
     */
    @Post('orders/:id/generate')
    async generateReading(@Param('id') orderId: string, @CurrentExpert() expert: Expert) {
        return this.expertService.generateReading(orderId, expert);
    }

    /**
     * Full generation endpoint (alias for generate).
     * Used by admin panel to trigger complete AI reading generation.
     */
    @Post('orders/:id/generate-full')
    async generateFullReading(
        @Param('id') orderId: string,
        @Body() body: { expertPrompt?: string },
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.generateReadingWithPrompt(orderId, body.expertPrompt, expert);
    }

    /**
     * Refine content using AI based on expert prompt.
     * Used in the Co-Creation Studio for content adjustments.
     */
    @Post('orders/:id/refine')
    async refineContent(
        @Param('id') orderId: string,
        @Body() dto: RefineContentDto,
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.refineContent(orderId, dto, expert);
    }

    /**
     * AI Chat endpoint for the Desk v2 AI Assistant.
     * Uses Gemini Flash model for fast conversational responses.
     */
    @Post('orders/:id/chat')
    async chatAboutOrder(
        @Param('id') orderId: string,
        @Body() dto: ChatOrderDto,
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.chatAboutOrder(orderId, dto, expert);
    }

    /**
     * Validate and seal an order from the Studio.
     * Generates final PDF and marks order as complete.
     */
    @Post('orders/:id/validate')
    async validateOrder(
        @Param('id') orderId: string,
        @Body() body: { content: string; approval: string },
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.validateFromStudio(orderId, body.content, body.approval, expert);
    }

    /**
     * Finalize an order from the Co-Creation Studio.
     * Seals the content and triggers PDF generation (Gotenberg).
     * Uses the current content from the Right Panel.
     */
    @Post('orders/:id/finalize')
    async finalizeOrder(
        @Param('id') orderId: string,
        @Body() dto: FinalizeOrderDto,
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.finalizeFromStudio(orderId, dto.finalContent, expert);
    }

    /**
     * Full regeneration from Studio - completely re-runs AI generation.
     * Saves current content to version history before regenerating.
     */
    @Post('orders/:id/regenerate')
    async regenerateOrder(
        @Param('id') orderId: string,
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.regenerateFromStudio(orderId, expert);
    }

    /**
     * Get content version history for an order.
     */
    @Get('orders/:id/versions')
    async getContentVersions(@Param('id') orderId: string) {
        return this.expertService.getContentVersions(orderId);
    }

    /**
     * Restore a previous content version.
     */
    @Post('orders/:id/versions/:index/restore')
    async restoreContentVersion(
        @Param('id') orderId: string,
        @Param('index') index: string,
        @CurrentExpert() expert: Expert,
    ) {
        return this.expertService.restoreContentVersion(orderId, parseInt(index, 10), expert);
    }

    /**
     * Clear old content versions (cleanup).
     */
    @Delete('orders/:id/versions')
    async clearOldVersions(
        @Param('id') orderId: string,
        @Query('keep') keep: string = '3',
    ) {
        return this.expertService.clearOldVersions(orderId, parseInt(keep, 10));
    }

    // ========================
    // CLIENTS
    // ========================

    @Get('clients')
    async getClients(@Query() query: ClientsQueryDto) {
        return this.expertService.getClients(query);
    }

    @Get('clients/stats')
    async getClientsStats() {
        return this.expertService.getClientsStats();
    }

    @Post('clients')
    async createClient(@Body() dto: CreateClientDto) {
        return this.expertService.createClient(dto);
    }

    @Get('clients/:id')
    async getClientById(@Param('id') id: string) {
        return this.expertService.getClientById(id);
    }

    @Get('clients/:id/full')
    async getClientFull(@Param('id') id: string) {
        return this.expertService.getClientFull(id);
    }

    @Get('clients/:id/stats')
    async getClientStats(@Param('id') id: string) {
        return this.expertService.getClientStats(id);
    }

    @Get('clients/:id/orders')
    async getClientOrders(@Param('id') id: string, @Query() query: PaginationDto) {
        return this.expertService.getClientOrders(id, query);
    }

    @Patch('clients/:id')
    async updateClient(@Param('id') id: string, @Body() dto: UpdateClientDto) {
        return this.expertService.updateClient(id, dto);
    }

    @Patch('clients/:id/status')
    async updateClientStatus(@Param('id') id: string, @Body() dto: UpdateClientStatusDto) {
        return this.expertService.updateClientStatus(id, dto);
    }

    @Delete('clients/:id')
    @Roles('ADMIN')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteClient(@Param('id') id: string) {
        await this.expertService.deleteClient(id);
    }

    @Post('clients/assign-ref-ids')
    @Roles('ADMIN')
    async assignMissingRefIds() {
        const count = await this.expertService.assignMissingRefIds();
        return { message: `Assigned refId to ${count} clients`, count };
    }

    // ========================
    // FILES
    // ========================

    @Get('files/presign')
    async getPresignedUrl(@Query('url') url: string) {
        const signedUrl = await this.expertService.getPresignedUrl(url);
        return { url: signedUrl };
    }

    // ========================
    // STATS
    // ========================

    @Get('stats')
    @SkipThrottle()
    async getStats() {
        return this.expertService.getStats();
    }

    // ========================
    // ADMIN SETTINGS
    // ========================

    @Get('settings/status')
    async getSettingsStatus() {
        return this.adminSettingsService.getConfigStatus();
    }

    @Get('settings/vertex-credentials')
    async getVertexCredentials() {
        return this.adminSettingsService.getVertexCredentialsForDisplay();
    }

    @Post('settings/vertex-test')
    async testVertexConnection() {
        return this.adminSettingsService.testVertexConnection();
    }

    @Post('settings/openai-test')
    async testOpenAIConnection() {
        return this.adminSettingsService.testOpenAIConnection();
    }

    @Put('settings/vertex-key')
    async setVertexKey(@Body('credentials') credentials: string) {
        return this.adminSettingsService.setVertexCredentials(credentials);
    }

    // ========================
    // AI PROMPTS MANAGEMENT
    // ========================

    @Get('settings/prompts')
    async getAllPrompts() {
        return this.adminSettingsService.getAllPrompts();
    }

    @Get('settings/prompts/defaults')
    async getDefaultPrompts() {
        return this.adminSettingsService.getDefaultPrompts();
    }

    @Get('settings/prompts/:key')
    async getPrompt(@Param('key') key: string) {
        return { key, value: await this.adminSettingsService.getPrompt(key) };
    }

    @Get('settings/prompts/:key/history')
    async getPromptHistory(@Param('key') key: string, @Query('limit') limit?: string) {
        const limitNum = limit ? parseInt(limit, 10) : 10;
        return this.adminSettingsService.getPromptHistory(key, limitNum);
    }

    @Put('settings/prompts/:key')
    async savePrompt(
        @Param('key') key: string,
        @Body('value') value: string,
        @Body('changedBy') changedBy?: string,
        @Body('comment') comment?: string,
    ) {
        return this.adminSettingsService.savePrompt(key, value, changedBy, comment);
    }

    @Post('settings/prompts/:key/restore/:version')
    async restorePromptVersion(
        @Param('key') key: string,
        @Param('version') version: string,
        @Body('changedBy') changedBy?: string,
    ) {
        return this.adminSettingsService.restorePromptVersion(key, parseInt(version, 10), changedBy);
    }

    @Post('settings/prompts/:key/reset')
    async resetPromptToDefault(@Param('key') key: string) {
        return this.adminSettingsService.resetPromptToDefault(key);
    }

    @Post('settings/prompts-reset-all')
    async resetAllPrompts() {
        return this.adminSettingsService.resetAllPromptsToDefaults();
    }

    @Get('settings/model-config')
    async getModelConfig() {
        return this.adminSettingsService.getModelConfig();
    }

    @Put('settings/model-config')
    async saveModelConfig(
        @Body() config: Partial<ModelConfig>,
        @Body('changedBy') changedBy?: string,
    ) {
        return this.adminSettingsService.saveModelConfig(config, changedBy);
    }
}
