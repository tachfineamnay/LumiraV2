import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';

export enum ExpertRole {
    EXPERT = 'EXPERT',
    ADMIN = 'ADMIN',
}

export class RegisterExpertDto {
    @IsEmail({}, { message: 'Email invalide' })
    email: string;

    @IsString({ message: 'Mot de passe requis' })
    @MinLength(8, { message: 'Mot de passe trop court (min 8 caractères)' })
    password: string;

    @IsString({ message: 'Nom requis' })
    name: string;

    @IsOptional()
    @IsEnum(ExpertRole, { message: 'Rôle invalide' })
    role?: ExpertRole;
}
