import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsObject,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateEditorialArticleDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsObject()
  contentJson: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @IsString()
  @IsOptional()
  coverAssetId?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsString()
  @IsOptional()
  focusKeyword?: string;

  @IsString()
  @IsOptional()
  canonical?: string;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;
}

export class UpdateEditorialArticleDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  excerpt?: string;

  @IsObject()
  @IsOptional()
  contentJson?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tagIds?: string[];

  @IsString()
  @IsOptional()
  coverAssetId?: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsString()
  @IsOptional()
  focusKeyword?: string;

  @IsString()
  @IsOptional()
  canonical?: string;

  @IsBoolean()
  @IsOptional()
  featured?: boolean;

}

export class ScheduleArticleDto {
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  scheduledAt: Date;
}
