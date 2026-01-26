import { IsEmail, IsNotEmpty, IsOptional, IsString, IsIn, IsArray } from 'class-validator';

export class CreateClientDto {
    @IsEmail({}, { message: 'Email invalide' })
    @IsNotEmpty({ message: 'Email requis' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'Prénom requis' })
    firstName: string;

    @IsString()
    @IsNotEmpty({ message: 'Nom requis' })
    lastName: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsString()
    notes?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    tags?: string[];

    @IsOptional()
    @IsString()
    @IsIn(['organic', 'referral', 'ads', 'social', 'manual', 'other'])
    source?: string;
}

export class UpdateClientStatusDto {
    @IsString()
    @IsIn(['ACTIVE', 'BANNED', 'SUSPENDED'])
    status: 'ACTIVE' | 'BANNED' | 'SUSPENDED';

    @IsOptional()
    @IsString()
    reason?: string;
}
