import { Module } from '@nestjs/common';
import { N8nController } from './n8n.controller';
import { N8nService } from './n8n.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [N8nController],
    providers: [N8nService],
})
export class WebhooksModule { }
