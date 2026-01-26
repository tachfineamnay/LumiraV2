import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * IdGenerator - Generates business-friendly sequential IDs
 * 
 * Formats:
 * - Client: LUM-C-YY-XXXX (e.g., LUM-C-26-0001)
 * - Order:  LUM-O-YYMMDD-XXX (e.g., LUM-O-260126-001)
 * 
 * The generator queries the database to find the last ID
 * and increments the sequence accordingly.
 */
@Injectable()
export class IdGenerator {
    private readonly logger = new Logger(IdGenerator.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Generate a new Client Reference ID
     * Format: LUM-C-YY-XXXX
     * Example: LUM-C-26-0042
     */
    async generateClientRefId(): Promise<string> {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2); // "26"
        const prefix = `LUM-C-${year}-`;

        // Find the highest existing refId for this year
        const lastClient = await this.prisma.user.findFirst({
            where: {
                refId: {
                    startsWith: prefix,
                },
            },
            orderBy: {
                refId: 'desc',
            },
            select: {
                refId: true,
            },
        });

        let nextSequence = 1;

        if (lastClient?.refId) {
            // Extract sequence number from LUM-C-26-0042 → 42
            const parts = lastClient.refId.split('-');
            const lastSequence = parseInt(parts[3], 10);
            if (!isNaN(lastSequence)) {
                nextSequence = lastSequence + 1;
            }
        }

        const refId = `${prefix}${nextSequence.toString().padStart(4, '0')}`;
        this.logger.debug(`Generated client refId: ${refId}`);

        return refId;
    }

    /**
     * Generate a new Order Number
     * Format: LUM-O-YYMMDD-XXX
     * Example: LUM-O-260126-003
     */
    async generateOrderNumber(): Promise<string> {
        const now = new Date();
        const dateStr = this.formatDate(now); // "260126"
        const prefix = `LUM-O-${dateStr}-`;

        // Find the highest existing orderNumber for today
        const lastOrder = await this.prisma.order.findFirst({
            where: {
                orderNumber: {
                    startsWith: prefix,
                },
            },
            orderBy: {
                orderNumber: 'desc',
            },
            select: {
                orderNumber: true,
            },
        });

        let nextSequence = 1;

        if (lastOrder?.orderNumber) {
            // Extract sequence number from LUM-O-260126-003 → 3
            const parts = lastOrder.orderNumber.split('-');
            const lastSequence = parseInt(parts[3], 10);
            if (!isNaN(lastSequence)) {
                nextSequence = lastSequence + 1;
            }
        }

        const orderNumber = `${prefix}${nextSequence.toString().padStart(3, '0')}`;
        this.logger.debug(`Generated orderNumber: ${orderNumber}`);

        return orderNumber;
    }

    /**
     * Format date as YYMMDD
     */
    private formatDate(date: Date): string {
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}${month}${day}`;
    }

    /**
     * Validate a Client Reference ID format
     */
    isValidClientRefId(refId: string): boolean {
        return /^LUM-C-\d{2}-\d{4}$/.test(refId);
    }

    /**
     * Validate an Order Number format
     */
    isValidOrderNumber(orderNumber: string): boolean {
        return /^LUM-O-\d{6}-\d{3}$/.test(orderNumber);
    }

    /**
     * Parse a Client Reference ID to extract components
     */
    parseClientRefId(refId: string): { year: string; sequence: number } | null {
        const match = refId.match(/^LUM-C-(\d{2})-(\d{4})$/);
        if (!match) return null;
        return {
            year: match[1],
            sequence: parseInt(match[2], 10),
        };
    }

    /**
     * Parse an Order Number to extract components
     */
    parseOrderNumber(orderNumber: string): { date: string; sequence: number } | null {
        const match = orderNumber.match(/^LUM-O-(\d{6})-(\d{3})$/);
        if (!match) return null;
        return {
            date: match[1],
            sequence: parseInt(match[2], 10),
        };
    }
}
