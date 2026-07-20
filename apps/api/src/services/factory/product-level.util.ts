import { ProductLevel } from '@prisma/client';

const SLUG_TO_LEVEL: Record<string, ProductLevel> = {
  initie: ProductLevel.INITIE,
  initié: ProductLevel.INITIE,
  '1': ProductLevel.INITIE,
  mystique: ProductLevel.MYSTIQUE,
  '2': ProductLevel.MYSTIQUE,
  profond: ProductLevel.PROFOND,
  '3': ProductLevel.PROFOND,
  integrale: ProductLevel.INTEGRALE,
  intégrale: ProductLevel.INTEGRALE,
  '4': ProductLevel.INTEGRALE,
};

export function productLevelFromAmountCents(amountCents: number): ProductLevel {
  if (amountCents <= 2900) return ProductLevel.INITIE;
  if (amountCents <= 5900) return ProductLevel.MYSTIQUE;
  if (amountCents <= 9900) return ProductLevel.PROFOND;
  return ProductLevel.INTEGRALE;
}

export function normalizeProductLevel(
  value?: string | ProductLevel | null,
): ProductLevel | undefined {
  if (!value) return undefined;
  if (Object.values(ProductLevel).includes(value as ProductLevel)) {
    return value as ProductLevel;
  }
  return SLUG_TO_LEVEL[value.toLowerCase().trim()];
}
