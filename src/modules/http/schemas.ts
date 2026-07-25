import { z } from 'zod';
import { validatePublicUrl } from '../../shared/utils/url.js';

export const idParams = z.object({ id: z.string().min(1) });
export const productIdParams = z.object({ productId: z.string().min(1) });
export const productInput = z.object({
  name: z.string().min(2).max(200),
  brand: z.string().max(100).optional(),
  model: z.string().min(1).max(150),
  category: z
    .enum(['MEMORY', 'CPU', 'GPU', 'MOTHERBOARD', 'SSD', 'PSU', 'CASE', 'MONITOR', 'OTHER'])
    .default('OTHER'),
  description: z.string().max(2000).optional(),
  targetPrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).default('USD'),
  enabled: z.boolean().default(true),
});
export const productPatch = productInput.partial();
const sourceFields = z.object({
  storeName: z.string().min(1).max(100),
  url: z.string().url().transform((value) => validatePublicUrl(value).toString()),
  country: z.string().length(2).transform((value) => value.toUpperCase()),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
  scraperType: z.enum(['STATIC', 'PLAYWRIGHT']).default('STATIC'),
  enabled: z.boolean().default(true),
  selectors: z.object({
    price: z.string().min(1).optional(),
    availability: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    seller: z.string().min(1).optional(),
  }),
  metadata: z.record(z.unknown()).optional(),
});
export const sourceInput = sourceFields.refine(
  (value) => value.selectors.price || value.selectors.availability,
  'At least one selector is required',
);
export const sourcePatch = sourceFields.partial();
export const historyQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  store: z.string().optional(),
  available: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  status: z.enum(['SUCCESS', 'FAILED', 'BLOCKED']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
