import { IsOptional, IsString } from 'class-validator';

export class CreateCheckoutDto {
    /**
     * Optional URL to redirect after successful payment.
     * Defaults to /sanctuaire on the frontend if omitted.
     */
    @IsOptional()
    @IsString()
    successUrl?: string;

    /**
     * Optional URL to redirect on cancellation.
     */
    @IsOptional()
    @IsString()
    cancelUrl?: string;
}
