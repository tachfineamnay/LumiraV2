import { IsString, IsOptional, MinLength } from 'class-validator';

export class RefineContentDto {
    @IsString({ message: 'Le prompt est requis' })
    @MinLength(3, { message: 'Le prompt doit contenir au moins 3 caractères' })
    prompt: string;

    @IsString({ message: 'Le contenu actuel est requis' })
    currentContent: string;

    @IsOptional()
    @IsString()
    section?: string; // Optional: specific section to refine
}
