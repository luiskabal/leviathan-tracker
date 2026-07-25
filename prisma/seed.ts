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

const bomProducts = [
  ['AMD Ryzen 9 9950X3D', 'AMD', '100-100000719WOF', 'CPU'],
  ['ASUS ROG Crosshair X870E Hero', 'ASUS', 'ROG CROSSHAIR X870E HERO', 'MOTHERBOARD'],
  ['ASUS ROG Astral GeForce RTX 5090 OC', 'ASUS', 'ROG-ASTRAL-RTX5090-O32G-GAMING', 'GPU'],
  ['MSI GeForce RTX 5090 SUPRIM SOC', 'MSI', 'RTX5090 SUPRIM SOC 32G', 'GPU'],
  ['G.Skill Trident Z5 Neo RGB 128 GB CL32', 'G.Skill', 'F5-6000J3244G64GX2-TZ5NR', 'MEMORY'],
  ['ARCTIC Liquid Freezer III Pro 420 Black', 'ARCTIC', 'ACFRE00181A', 'OTHER'],
  ['Seasonic PRIME TX-1600 Noctua Edition', 'Seasonic', 'PRIME-TX-1600-NOCTUA', 'PSU'],
  ['Fractal Design Define 7 XL Black Solid', 'Fractal Design', 'DEFINE-7-XL-BLACK-SOLID', 'CASE'],
  ['Noctua NF-A14x25 G2 PWM chromax.black', 'Noctua', 'NF-A14X25-G2-PWM-CHROMAX-BLACK', 'OTHER'],
  ['Samsung 9100 PRO 2 TB', 'Samsung', 'MZ-VAP2T0BW', 'SSD'],
  ['Samsung 9100 PRO 4 TB', 'Samsung', 'MZ-VAP4T0BW', 'SSD'],
  ['Samsung 990 PRO 4 TB', 'Samsung', 'MZ-V9P4T0BW', 'SSD'],
] as const;

const productsByModel = new Map([[product.model, product]]);
for (const [name, brand, model, category] of bomProducts) {
  const bomProduct = await prisma.product.upsert({
    where: { model },
    update: { name, brand, category },
    create: { name, brand, model, category, currency: 'CLP' },
  });
  productsByModel.set(model, bomProduct);
}

const chileSources = [
  [
    '100-100000719WOF',
    'https://www.solotodo.cl/products/269507-amd-ryzen-9-9950x3d-100-100000719wof',
    'STATIC',
    { price: 'main a[href^="https://"]', title: 'main h1', seller: 'main a[href^="https://"]' },
  ],
  [
    'ROG CROSSHAIR X870E HERO',
    'https://www.solotodo.cl/products/255492-asus-rog-crosshair-x870e-hero',
    'STATIC',
    { price: 'main a[href^="https://"]', title: 'main h1', seller: 'main a[href^="https://"]' },
  ],
  [
    'ROG-ASTRAL-RTX5090-O32G-GAMING',
    'https://www.solotodo.cl/products/269747-asus-rog-astral-rtx5090-o32g-gaming-90yv0lw0-m0aa00',
    'PLAYWRIGHT',
    { price: 'main a[href^="https://"]', title: 'main h1', seller: 'main a[href^="https://"]' },
  ],
  [
    'RTX5090 SUPRIM SOC 32G',
    'https://www.solotodo.cl/products/357003-msi-geforce-rtx-5090-32g-suprim-soc-g5090-32sps',
    'STATIC',
    { availability: 'main', title: 'main h1' },
  ],
  [
    'ACFRE00181A',
    'https://www.solotodo.cl/products/354519-arctic-liquid-freezer-iii-pro-420-black-acfre00181a',
    'STATIC',
    { price: 'main a[href^="https://"]', title: 'main h1', seller: 'main a[href^="https://"]' },
  ],
  [
    'PRIME-TX-1600-NOCTUA',
    'https://www.solotodo.cl/products/363934-seasonic-prime-tx-1600-noctua-edition-ssr-1600tr2-ne-1600-w',
    'STATIC',
    { price: 'main a[href^="https://"]', title: 'main h1', seller: 'main a[href^="https://"]' },
  ],
] as const;

for (const [model, url, scraperType, selectors] of chileSources) {
  const sourceProduct = productsByModel.get(model);
  if (!sourceProduct) throw new Error(`Missing BOM product ${model}`);
  await prisma.productSource.upsert({
    where: { url },
    update: { productId: sourceProduct.id, scraperType, selectors, enabled: true },
    create: {
      productId: sourceProduct.id,
      storeName: 'SoloTodo Chile',
      url,
      country: 'CL',
      currency: 'CLP',
      scraperType,
      enabled: true,
      selectors,
      metadata: {
        notes:
          'Modelo exacto verificado en el HTML de SoloTodo el 2026-07-24. Los enlaces externos representan ofertas de tiendas chilenas.',
      },
    },
  });
}

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
