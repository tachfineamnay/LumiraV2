import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProfileFieldAmendmentDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  fields!: string[];

  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class SaveProfileFieldAmendmentDraftDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsObject()
  values!: Record<string, unknown>;
}

export class SubmitProfileFieldAmendmentDto extends SaveProfileFieldAmendmentDraftDto {}

export class ReviewProfileFieldAmendmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
