import { IsString, IsOptional, IsObject } from 'class-validator';

export class ChatOrderDto {
    @IsString()
    message: string;

    @IsOptional()
    @IsObject()
    context?: {
        firstName?: string;
        birthDate?: string;
        question?: string;
        objective?: string;
        emotionalState?: string;
    };
}

export interface ChatHistory {
    role: 'user' | 'model';
    content: string;
}
