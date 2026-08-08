import {
  IsBoolean,
  IsString,
  IsOptional,
  IsNumber,
  IsObject,
  IsArray,
  IsInt,
} from 'class-validator';

export class UpdateEditorialIntelligenceSettingsDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsObject()
  @IsOptional()
  models?: Record<string, string>;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  secondaryMarkets?: string[];

  @IsBoolean()
  @IsOptional()
  groundingEnabled?: boolean;

  @IsNumber()
  @IsOptional()
  confidenceMinimum?: number;

  @IsObject()
  @IsOptional()
  opportunityWeights?: Record<string, number>;

  @IsBoolean()
  @IsOptional()
  opportunityScanEnabled?: boolean;

  @IsString()
  @IsOptional()
  opportunityScanFrequency?: string;

  @IsBoolean()
  @IsOptional()
  competitorScanEnabled?: boolean;

  @IsString()
  @IsOptional()
  competitorScanFrequency?: string;

  @IsBoolean()
  @IsOptional()
  performanceSyncEnabled?: boolean;

  @IsInt()
  @IsOptional()
  dailyCallLimit?: number;

  @IsInt()
  @IsOptional()
  monthlyWarningThreshold?: number;

  @IsInt()
  @IsOptional()
  concurrencyLimit?: number;

  @IsInt()
  @IsOptional()
  timeoutMs?: number;
}
