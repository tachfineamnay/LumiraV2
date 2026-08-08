import { IsBoolean, IsString, IsNotEmpty, IsOptional, IsArray, IsObject } from 'class-validator';

export class CreateEditorialCompetitorDto {
  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  @IsOptional()
  isTracked?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetKeywords?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateEditorialCompetitorDto {
  @IsString()
  @IsOptional()
  domain?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isTracked?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetKeywords?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
