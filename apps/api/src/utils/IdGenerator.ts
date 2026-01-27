import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * IdGenerator - Generates business-friendly sequential IDs
 * 
 * Formats:
 * - Client: LUM-C-YY-XXXX (e.g., LUM-C-26-0001)
 * - Order:  LUM-O-YYMMDD-XXX (e.g., LUM-O-260126-001)
 * 
 * Uses atomic SequenceCounter for concurrency safety.
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
        const counterName = `client_${year}`;
        
        const nextSequence = await this.incrementCounter(counterName);
        const refId = `LUM-C-${year}-${nextSequence.toString().padStart(4, '0')}`;
        
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
        const counterName = `order_${dateStr}`;
        
        const nextSequence = await this.incrementCounter(counterName);
        const orderNumber = `LUM-O-${dateStr}-${nextSequence.toString().padStart(3, '0')}`;
        
        this.logger.debug(`Generated orderNumber: ${orderNumber}`);
        return orderNumber;
    }

    /**
     * Atomic counter increment using Prisma transaction
     * Handles race conditions by using database-level atomicity
     */
    private async incrementCounter(name: string): Promise<number> {
        const result = await this.prisma.$transaction(async (tx) => {
            const existing = await tx.sequenceCounter.findUnique({
                where: { name },
            });

            if (existing) {
                const updated = await tx.sequenceCounter.update({
                    where: { name },
                    data: { value: { increment: 1 } },
                });
                return updated.value;
            } else {
                const created = await tx.sequenceCounter.create({
                    data: { name, value: 1 },
                });
                return created.value;
            }
        });

        return result;
    }

    /**
     * Get current counter value without incrementing
     */
    async getCurrentCounterValue(counterName: string): Promise<number> {
        const counter = await this.prisma.sequenceCounter.findUnique({
            where: { name: counterName },
        });
        return counter?.value ?? 0;
    }

    /**
     * List all sequence counters (for admin monitoring)
     */
    async listCounters(): Promise<{ name: string; value: number; updatedAt: Date }[]> {
        const counters = await this.prisma.sequenceCounter.findMany({
            orderBy: { name: 'asc' },
        });
        return counters.map(c => ({
            name: c.name,
            value: c.value,
            updatedAt: c.updatedAt,
        }));
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
