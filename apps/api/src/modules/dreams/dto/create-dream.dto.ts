import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class CreateDreamDto {
    @IsString()
    @MinLength(20, { message: 'Le rêve doit contenir au moins 20 caractères.' })
    @MaxLength(2000, { message: 'Le rêve ne peut pas dépasser 2000 caractères.' })
    content: string;

    @IsOptional()
    @IsString()
    emotion?: string;
}
