import { IsString, MinLength, IsOptional } from 'class-validator';

export class ProcessOrderDto {
    @IsString({ message: 'ID de commande requis' })
    orderId: string;

    @IsString({ message: 'Prompt expert requis' })
    @MinLength(10, { message: 'Prompt trop court (min 10 caractères)' })
    expertPrompt: string;

    @IsOptional()
    @IsString()
    expertInstructions?: string;
}
