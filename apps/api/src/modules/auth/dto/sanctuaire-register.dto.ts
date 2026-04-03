import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SanctuaireRegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsString()
    @IsOptional()
    phone?: string;
}
