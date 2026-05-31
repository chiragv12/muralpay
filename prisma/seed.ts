import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const catalog: Array<{
    sku: string;
    name: string;
    description: string;
    priceUsd: Prisma.Decimal;
  }> = [
    {
      sku: 'ART-PRINT-A4',
      name: 'Limited art print (A4)',
      description: 'Giclée on archival paper.',
      priceUsd: new Prisma.Decimal('45.00'),
    },
    {
      sku: 'TOTE-NATURAL',
      name: 'Canvas tote',
      description: 'Natural fiber, heavy duty.',
      priceUsd: new Prisma.Decimal('22.50'),
    },
    {
      sku: 'HOODIE-ASH',
      name: 'Unisex hoodie',
      description: 'Ash gray, mid-weight fleece.',
      priceUsd: new Prisma.Decimal('68.00'),
    },
    {
      sku: 'STICKER-PACK',
      name: 'Sticker pack (5)',
      description: 'Vinyl stickers; assorted designs.',
      priceUsd: new Prisma.Decimal('12.00'),
    },
  ];

  for (const item of catalog) {
    await prisma.product.upsert({
      where: { sku: item.sku },
      create: item,
      update: {
        name: item.name,
        description: item.description,
        priceUsd: item.priceUsd,
        active: true,
      },
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (err: unknown) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
