import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OnboardingConsentDto {
  @IsBoolean()
  accepted: boolean;

  @IsString()
  @MaxLength(64)
  version: string;
}

export class UpdateProfileDto {
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

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingConsentDto)
  consent?: OnboardingConsentDto;
}

export class UpdateOnboardingProgressDto {
  @IsInt()
  @Min(0)
  @Max(5)
  currentStep: number;

  @IsObject()
  data: Record<string, unknown>;
}

export class CreateOnboardingPhotoDto {
  @IsIn(['FACE', 'PALM'])
  kind: 'FACE' | 'PALM';

  @IsIn(['image/jpeg', 'image/png', 'image/webp'])
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
}
