import { IsString, IsIn, IsOptional } from 'class-validator';

export class ValidateContentDto {
    @IsString({ message: 'ID de commande requis' })
    orderId: string;

    @IsIn(['approve', 'reject'], { message: 'Action doit être approve ou reject' })
    action: 'approve' | 'reject';

    @IsOptional()
    @IsString()
    validationNotes?: string;

    @IsOptional()
    @IsString()
    rejectionReason?: string;
}
