import { IsString, IsArray, ValidateNested, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { InsightCategory } from '@prisma/client';

class InsightInputDto {
    @IsEnum(InsightCategory)
    category: InsightCategory;

    @IsString()
    short: string;

    @IsString()
    full: string;
}

export class UpsertInsightsDto {
    @IsString()
    userId: string;

    @IsString()
    @IsOptional()
    orderId?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => InsightInputDto)
    insights: InsightInputDto[];
}
