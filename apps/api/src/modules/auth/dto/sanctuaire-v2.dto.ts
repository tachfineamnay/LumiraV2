import { IsEmail, IsNotEmpty } from 'class-validator';

/**
 * DTO for Sanctuaire V2 passwordless authentication.
 * Clients authenticate using only their order email.
 */
export class SanctuaireAuthDto {
    @IsEmail({}, { message: 'Veuillez fournir un email valide' })
    @IsNotEmpty({ message: 'L\'email est requis' })
    email: string;
}

/**
 * Response from successful Sanctuaire authentication
 */
export interface SanctuaireAuthResponse {
    success: true;
    token: string;
    user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        level: number;
    };
}

/**
 * Error response from failed Sanctuaire authentication
 */
export interface SanctuaireAuthErrorResponse {
    success: false;
    error: string;
}
