import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const MEMORY_STATUSES = [
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'SUPERSEDED',
  'DELETED',
  'SYNC_FAILED',
] as const;

export class MemoryClientParamsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  clientId: string;
}

export class MemoryParamsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  memoryId: string;
}

export class MemoryScopedParamsDto extends MemoryClientParamsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  memoryId: string;
}

export class MemoryJobParamsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  jobId: string;
}

export class MemoryScopedJobParamsDto extends MemoryClientParamsDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  jobId: string;
}

export class EditMemoryDto {
  @IsString()
  @MinLength(16)
  @MaxLength(480)
  fact: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'PREFERENCE',
    'LIFE_CONTEXT',
    'IMPORTANT_EVENT',
    'RECURRING_THEME',
    'EVOLUTION',
    'OPEN_QUESTION',
    'EXPERT_VALIDATED_ANCHOR',
    'READING_CONTINUITY',
  ])
  category?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  supersedeMemoryId?: string;

  @IsOptional()
  @IsIn(['SUPERSEDE', 'KEEP_BOTH'])
  conflictResolution?: 'SUPERSEDE' | 'KEEP_BOTH';

  @IsOptional()
  @IsBoolean()
  confirmKeepBoth?: boolean;
}

export class ApproveMemoryDto {
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  supersedeMemoryId?: string;

  @IsOptional()
  @IsIn(['SUPERSEDE', 'KEEP_BOTH'])
  conflictResolution?: 'SUPERSEDE' | 'KEEP_BOTH';

  @IsOptional()
  @IsBoolean()
  confirmKeepBoth?: boolean;
}

export class ListMemoryJobsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class BackfillMemoryJobsDto {
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean = true;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  orderId?: string;
}

export class CreateDiagnosticMemoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export { MEMORY_STATUSES };
