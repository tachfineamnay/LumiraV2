import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { ReadingIntakeService } from './reading-intake.service';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, ReadingIntakeService],
  exports: [UsersService, ReadingIntakeService],
})
export class UsersModule {}
