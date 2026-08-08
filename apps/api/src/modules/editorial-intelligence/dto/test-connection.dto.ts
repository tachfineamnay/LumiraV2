import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EditorialModelProfile } from '@prisma/client';

export class TestConnectionDto {
  @IsEnum(EditorialModelProfile)
  @IsOptional()
  profile?: EditorialModelProfile;

  @IsString()
  @IsOptional()
  prompt?: string;
}
