import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CheckoutIntentDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsString()
  @IsOptional()
  phone?: string;

  /** Product catalog key — amount is resolved server-side from LUMIRA_EARLY_OFFER */
  @IsString()
  @IsNotEmpty()
  @Matches(/^(lumira_early_v1|lumira_lifetime_v1|1|2|3|4|initie|subscription)$/i)
  productLevel: string;
}
