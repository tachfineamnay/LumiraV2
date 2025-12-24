import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginClientDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}

export class LoginExpertDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(6)
    password: string;
}
