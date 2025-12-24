import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateOrderDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    firstName: string;

    @IsString()
    @IsNotEmpty()
    lastName: string;

    @IsNumber()
    @IsNotEmpty()
    totalAmount: number;

    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsOptional()
    birthDate?: string;

    @IsString()
    @IsOptional()
    birthTime?: string;

    @IsString()
    @IsOptional()
    birthPlace?: string;

    @IsString()
    @IsOptional()
    specificQuestion?: string;
}

export class UpdateOrderDto {
    @IsString()
    @IsOptional()
    status?: string;

    @IsString()
    @IsOptional()
    paymentIntentId?: string;
}
