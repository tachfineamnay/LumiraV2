import { ProductLevel } from '@prisma/client';
import {
  productLevelFromNumericLevel,
  productLevelFromAmountCents,
  normalizeProductLevel,
} from './product-level.util';

describe('product-level.util', () => {
  describe('productLevelFromNumericLevel', () => {
    it('maps 1 to INITIE', () => {
      expect(productLevelFromNumericLevel(1)).toBe(ProductLevel.INITIE);
    });

    it('maps 2 to MYSTIQUE', () => {
      expect(productLevelFromNumericLevel(2)).toBe(ProductLevel.MYSTIQUE);
    });

    it('maps 3 to PROFOND', () => {
      expect(productLevelFromNumericLevel(3)).toBe(ProductLevel.PROFOND);
    });

    it('maps 4 to INTEGRALE', () => {
      expect(productLevelFromNumericLevel(4)).toBe(ProductLevel.INTEGRALE);
    });

    it('returns INITIE for unknown or fallback numeric levels', () => {
      expect(productLevelFromNumericLevel(0)).toBe(ProductLevel.INITIE);
      expect(productLevelFromNumericLevel(99)).toBe(ProductLevel.INITIE);
    });
  });

  describe('productLevelFromAmountCents', () => {
    it('returns correct ProductLevel based on amount in cents', () => {
      expect(productLevelFromAmountCents(2000)).toBe(ProductLevel.INITIE);
      expect(productLevelFromAmountCents(4500)).toBe(ProductLevel.MYSTIQUE);
      expect(productLevelFromAmountCents(7500)).toBe(ProductLevel.PROFOND);
      expect(productLevelFromAmountCents(12000)).toBe(ProductLevel.INTEGRALE);
    });
  });

  describe('normalizeProductLevel', () => {
    it('normalizes string values', () => {
      expect(normalizeProductLevel('initie')).toBe(ProductLevel.INITIE);
      expect(normalizeProductLevel('MYSTIQUE')).toBe(ProductLevel.MYSTIQUE);
      expect(normalizeProductLevel('undefined')).toBeUndefined();
    });
  });
});
