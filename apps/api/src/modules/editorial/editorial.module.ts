import { Module } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaModule } from '../../prisma/prisma.module';
import { EditorialAdminController } from './editorial-admin.controller';
import { EditorialPublicController } from './editorial-public.controller';
import { EditorialService } from './editorial.service';

@Module({
  imports: [PrismaModule],
  controllers: [EditorialAdminController, EditorialPublicController],
  providers: [EditorialService, JwtService],
  exports: [EditorialService],
})
export class EditorialModule {}
