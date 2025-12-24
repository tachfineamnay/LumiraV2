import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginExpertDto {
    @IsEmail({}, { message: 'Email invalide' })
    email: string;

    @IsString({ message: 'Mot de passe requis' })
    @MinLength(6, { message: 'Mot de passe trop court (min 6 caractères)' })
    password: string;
}
