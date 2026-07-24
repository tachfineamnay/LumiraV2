import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { CanonicalReadingContent } from '../reading-version';

export class GenerateWorkspaceReadingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(6000)
  orientation: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  priorities?: string[];

  @IsOptional()
  @IsIn(['DOUX_ET_CLAIR', 'DIRECT_ET_CONCRET', 'SYMBOLIQUE_ET_PROFOND'])
  tone?: 'DOUX_ET_CLAIR' | 'DIRECT_ET_CONCRET' | 'SYMBOLIQUE_ET_PROFOND';
}

export class SaveStructuredReadingDto {
  @IsObject()
  content: CanonicalReadingContent;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}

export class PatchReadingBlockDto {
  value: unknown;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}

export class ReviseReadingBlockDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  instruction: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  expectedRevision?: number;
}

export class SealStructuredReadingDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeWarnings?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

export class ReopenStructuredReadingDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
