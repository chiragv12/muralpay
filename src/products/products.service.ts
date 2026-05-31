import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatUsd } from '../util/money';
import type { ProductResponseDto } from './product-response.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(): Promise<ProductResponseDto[]> {
    const rows = await this.prisma.product.findMany({
      where: { active: true },
      orderBy: { sku: 'asc' },
    });

    return rows.map((p) => ({
      ...p,
      priceUsd: formatUsd(p.priceUsd),
    }));
  }
}
