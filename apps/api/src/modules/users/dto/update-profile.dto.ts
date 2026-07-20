import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingConsentDto {
  @IsBoolean()
  accepted: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  version?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  birthTime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  birthPlace?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specificQuestion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objective?: string;

  /** Only a private s3://onboarding/{userId}/ reference is accepted. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  facePhotoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  palmPhotoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  highs?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lows?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strongSide?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weakSide?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strongZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weakZone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deliveryStyle?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  pace?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  ailments?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fears?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  rituals?: string;

  @IsOptional()
  @IsBoolean()
  profileCompleted?: boolean;

  /** Revision of the server-side draft explicitly reviewed by the client. */
  @IsOptional()
  @IsInt()
  @Min(0)
  intakeRevision?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingConsentDto)
  consent?: OnboardingConsentDto;
}

/** Strict, serializable payload persisted for an order-scoped reading intake. */
export class OnboardingDraftDataDto {
  @IsOptional()
  @IsBoolean()
  openReading?: boolean;

  /** Frontend form topology marker (five-step mobile/desktop flow). */
  @IsOptional()
  @IsInt()
  @IsIn([2])
  schemaVersion?: number;

  @ValidateIf((_object, value) => value !== undefined && value !== null && value !== '')
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  birthTime?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  birthPlace?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  specificQuestion?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  objective?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  facePhoto?: string | null;

  /** Legacy draft key accepted during the compatibility window. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  facePhotoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  palmPhoto?: string | null;

  /** Legacy draft key accepted during the compatibility window. */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  palmPhotoUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  highs?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  lows?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strongSide?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weakSide?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  strongZone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  weakZone?: string | null;

  @IsOptional()
  @IsIn(['DOUX_ET_CLAIR', 'DIRECT_ET_CONCRET', 'SYMBOLIQUE_ET_PROFOND'])
  deliveryStyle?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  pace?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  ailments?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fears?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  rituals?: string | null;
}

export class UpdateOnboardingProgressDto {
  @IsOptional()
  @IsString()
  orderId?: string;

  @IsInt()
  @Min(0)
  @Max(4)
  currentStep: number;

  @ValidateNested()
  @Type(() => OnboardingDraftDataDto)
  data: OnboardingDraftDataDto;

  /** Optional only for the legacy frontend rollout; current clients must send it. */
  @IsOptional()
  @IsInt()
  @Min(0)
  revision?: number;
}

export class CreateOnboardingPhotoDto {
  @IsIn(['FACE', 'PALM'])
  kind: 'FACE' | 'PALM';

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}
