import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePalmAmendmentDto {
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason!: string;

  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}

export class SavePalmAmendmentDraftDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  storageRef?: string;

  @IsIn(['PALM_LEFT', 'PALM_RIGHT', 'PALM_UNKNOWN'])
  palmRole!: 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
}

export class SubmitPalmAmendmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  storageRef!: string;

  @IsIn(['PALM_LEFT', 'PALM_RIGHT', 'PALM_UNKNOWN'])
  palmRole!: 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';
}

export class ReviewPalmAmendmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

/** Union-shaped controller contract. The facade dispatches by persisted kind. */
export class SaveReadingAmendmentDraftDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedRevision!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  storageRef?: string;

  @IsOptional()
  @IsIn(['PALM_LEFT', 'PALM_RIGHT', 'PALM_UNKNOWN'])
  palmRole?: 'PALM_LEFT' | 'PALM_RIGHT' | 'PALM_UNKNOWN';

  @IsOptional()
  @IsObject()
  values?: Record<string, unknown>;
}

export class SubmitReadingAmendmentDto extends SaveReadingAmendmentDraftDto {}
