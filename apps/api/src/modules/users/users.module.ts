import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ExpertModule } from '../expert/expert.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReadingIntakeService } from './reading-intake.service';

@Module({
  imports: [PrismaModule, UploadsModule, ExpertModule],
  controllers: [UsersController],
  providers: [UsersService, ReadingIntakeService],
  exports: [UsersService, ReadingIntakeService],
})
export class UsersModule {}
