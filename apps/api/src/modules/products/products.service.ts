import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Product, ProductLevel } from '@prisma/client';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async findAll(): Promise<Product[]> {
        return this.prisma.product.findMany({
            where: { isActive: true },
            orderBy: { amountCents: 'asc' },
        });
    }

    async findByLevel(level: string): Promise<Product | null> {
        const levelMap: Record<string, ProductLevel> = {
            'initie': ProductLevel.INITIE,
            'mystique': ProductLevel.MYSTIQUE,
            'profond': ProductLevel.PROFOND,
            'integrale': ProductLevel.INTEGRALE,
        };

        const productLevel = levelMap[level.toLowerCase()];
        if (!productLevel) return null;

        return this.prisma.product.findFirst({
            where: {
                level: productLevel,
                isActive: true
            },
        });
    }
}
