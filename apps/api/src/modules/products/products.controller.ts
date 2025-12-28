import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
    constructor(private readonly productsService: ProductsService) { }

    @Get()
    async findAll() {
        return this.productsService.findAll();
    }

    @Get(':level')
    async findByLevel(@Param('level') level: string) {
        const product = await this.productsService.findByLevel(level);
        if (!product) {
            throw new NotFoundException(`Product with level "${level}" not found`);
        }
        return product;
    }
}
