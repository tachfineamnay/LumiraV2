import { Module } from '@nestjs/common';
import { DreamsController } from './dreams.controller';
import { DreamsService } from './dreams.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { ServicesModule } from '../../services/services.module';

@Module({
    imports: [PrismaModule, ServicesModule],
    controllers: [DreamsController],
    providers: [DreamsService],
    exports: [DreamsService],
})
export class DreamsModule {}
