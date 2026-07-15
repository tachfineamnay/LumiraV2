import { IsEmail, IsNotEmpty } from 'class-validator';

/** Request a passwordless Sanctuaire magic link for an order email. */
export class SanctuaireAuthDto {
  @IsEmail({}, { message: 'Veuillez fournir un email valide' })
  @IsNotEmpty({ message: "L'email est requis" })
  email: string;
}

/** Consume a single-use Sanctuaire magic link. */
export class SanctuaireMagicLinkDto {
  @IsNotEmpty({ message: 'Le lien de connexion est requis' })
  token: string;
}

export interface SanctuaireAuthResponse {
  success: true;
  message?: string;
}

/**
 * Error response from failed Sanctuaire authentication
 */
export interface SanctuaireAuthErrorResponse {
  success: false;
  error: string;
}
