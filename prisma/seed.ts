import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const product = await prisma.product.upsert({
  where: { model: 'F5-6000J3444F64GX2-TZ5NR' },
  update: {},
  create: {
    name: 'G.Skill Trident Z5 Neo RGB 128 GB',
    brand: 'G.Skill',
    model: 'F5-6000J3444F64GX2-TZ5NR',
    category: 'MEMORY',
    description: 'Kit 2×64 GB DDR5-6000 CL34 con perfil AMD EXPO',
    targetPrice: 550,
    currency: 'USD',
    alertRules: {
      create: [
        { type: 'IN_STOCK', cooldownMinutes: 720 },
        { type: 'PRICE_BELOW', targetValue: 550, cooldownMinutes: 720 },
      ],
    },
  },
});

const examples = [
  ['Newegg', 'https://www.newegg.com/', 'US'],
  ['B&H', 'https://www.bhphotovideo.com/', 'US'],
  ['Micro Center', 'https://www.microcenter.com/', 'US'],
  ['Amazon', 'https://www.amazon.com/', 'US'],
  ['Generic example', 'https://example.com/replace-with-product-url', 'US'],
] as const;

for (const [storeName, url, country] of examples) {
  await prisma.productSource.upsert({
    where: { url },
    update: {},
    create: {
      productId: product.id,
      storeName,
      url,
      country,
      currency: 'USD',
      scraperType: 'STATIC',
      enabled: false,
      selectors: { price: '.EXAMPLE-price', availability: '.EXAMPLE-availability' },
      metadata: {
        warning:
          'EXAMPLE ONLY: replace URL and selectors after inspecting the site and its terms. Not guaranteed.',
      },
    },
  });
}

if (process.env.DISCORD_WEBHOOK_URL) {
  await prisma.notificationChannel.upsert({
    where: { id: 'seed-discord' },
    update: { configuration: { url: process.env.DISCORD_WEBHOOK_URL }, enabled: true },
    create: {
      id: 'seed-discord',
      type: 'DISCORD',
      name: 'Discord (environment seed)',
      configuration: { url: process.env.DISCORD_WEBHOOK_URL },
    },
  });
}

await prisma.$disconnect();
