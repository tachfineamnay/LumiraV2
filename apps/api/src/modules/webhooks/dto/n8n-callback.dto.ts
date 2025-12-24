import { IsString, IsNotEmpty, IsObject, ValidateNested, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratedContentDto {
    @IsString()
    @IsOptional()
    archetype?: string;

    @IsString()
    @IsOptional()
    reading?: string;

    @IsString()
    @IsOptional()
    pdfUrl?: string;

    @IsString()
    @IsOptional()
    audioUrl?: string;

    @IsString()
    @IsOptional()
    mandalaSvg?: string;

    @IsString()
    @IsOptional()
    ritual?: string;

    @IsString()
    @IsOptional()
    blockagesAnalysis?: string;

    @IsString()
    @IsOptional()
    soulProfile?: string;
}

export class N8nCallbackDto {
    @IsString()
    @IsNotEmpty()
    orderId: string;

    @IsString()
    @IsNotEmpty()
    orderNumber: string;

    @IsString()
    @IsNotEmpty()
    @IsEnum(['ready', 'failed'])
    status: string;

    @IsObject()
    @ValidateNested()
    @Type(() => GeneratedContentDto)
    content: GeneratedContentDto;
}
