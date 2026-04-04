import { IsOptional, IsInt, Min, Max, IsString, IsIn, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ClientsQueryDto {
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    @IsIn(['ACTIVE', 'BANNED', 'SUSPENDED'])
    status?: string;

    @IsOptional()
    @IsString()
    @IsIn(['ACTIVE', 'INACTIVE', 'TRIAL', 'PAST_DUE', 'CANCELED', 'EXPIRED'])
    subscriptionStatus?: string;

    @IsOptional()
    @Transform(({ value }) => value === 'true' || value === true)
    @IsBoolean()
    hasOrders?: boolean;

    @IsOptional()
    @IsString()
    dateFrom?: string;

    @IsOptional()
    @IsString()
    dateTo?: string;

    @IsOptional()
    @IsString()
    @IsIn(['createdAt', 'firstName', 'totalOrders', 'totalSpent'])
    sortBy?: string = 'createdAt';

    @IsOptional()
    @IsString()
    @IsIn(['asc', 'desc'])
    sortOrder?: string = 'desc';
}
