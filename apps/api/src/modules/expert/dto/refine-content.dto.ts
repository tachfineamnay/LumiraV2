import { IsString, IsOptional, MaxLength, MinLength } from 'class-validator';

export class RefineContentDto {
  @IsString({ message: 'Le contenu actuel est requis' })
  currentContent: string;

  @IsString({ message: "L'instruction est requise" })
  @MinLength(3, { message: "L'instruction doit contenir au moins 3 caractères" })
  instruction: string;

  @IsOptional()
  @IsString()
  section?: string; // Optional: specific section to refine
}

export class FinalizeOrderDto {
  @IsString({ message: 'Le contenu final est requis' })
  @MinLength(1, { message: 'Le contenu final est requis' })
  @MaxLength(120000, { message: 'Le contenu final dépasse la taille autorisée' })
  finalContent: string;
}
