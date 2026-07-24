import { ReadingCalculationsService } from './reading-calculations.service';

describe('ReadingCalculationsService', () => {
  let service: ReadingCalculationsService;

  beforeEach(() => {
    service = new ReadingCalculationsService();
  });

  describe('1. 22/02/1986', () => {
    it('calcule correctement la date 22/02/1986', () => {
      const result = service.calculate('22/02/1986');
      expect(result.birthDateValid).toBe(true);
      expect(result.birthDayNumber).toBe(22);
      expect(result.lifePathNumber).toBe(3);
      expect(result.lifePathCalculation).toBe('2+2+0+2+1+9+8+6=30→3');
      expect(result.astrologicalSign).toBeNull();
    });

    it('calcule la même date sous format ISO 1986-02-22', () => {
      const result = service.calculate('1986-02-22');
      expect(result.birthDateValid).toBe(true);
      expect(result.birthDayNumber).toBe(22);
      expect(result.lifePathNumber).toBe(3);
      expect(result.lifePathCalculation).toBe('2+2+0+2+1+9+8+6=30→3');
    });
  });

  describe('2. Date simple', () => {
    it('calcule une date simple avec réductions multiples (05/04/1990)', () => {
      const result = service.calculate('05/04/1990');
      expect(result.birthDateValid).toBe(true);
      expect(result.birthDayNumber).toBe(5);
      expect(result.lifePathNumber).toBe(1);
      expect(result.lifePathCalculation).toBe('0+5+0+4+1+9+9+0=28→10→1');
      expect(result.astrologicalSign).toBeNull();
    });
  });

  describe('3. Nombres maîtres (11, 22, 33)', () => {
    it('préserve le nombre maître 11 sans réduction supplémentaire (18/02/1980)', () => {
      const result = service.calculate('18/02/1980');
      expect(result.birthDateValid).toBe(true);
      expect(result.birthDayNumber).toBe(18);
      expect(result.lifePathNumber).toBe(11);
      expect(result.lifePathCalculation).toBe('1+8+0+2+1+9+8+0=29→11');
    });

    it('préserve le nombre maître 33 sans réduction supplémentaire (05/04/1995)', () => {
      const result = service.calculate('05/04/1995');
      expect(result.birthDateValid).toBe(true);
      expect(result.birthDayNumber).toBe(5);
      expect(result.lifePathNumber).toBe(33);
      expect(result.lifePathCalculation).toBe('0+5+0+4+1+9+9+5=33');
    });
  });

  describe('4. Date invalide', () => {
    it('retourne birthDateValid: false pour 31/02/1986', () => {
      const result = service.calculate('31/02/1986');
      expect(result.birthDateValid).toBe(false);
      expect(result.birthDayNumber).toBeNull();
      expect(result.lifePathNumber).toBeNull();
      expect(result.lifePathCalculation).toBeNull();
      expect(result.astrologicalSign).toBeNull();
    });

    it('retourne birthDateValid: false pour une chaîne corrompue ou un faux format', () => {
      expect(service.calculate('pas-une-date').birthDateValid).toBe(false);
      expect(service.calculate('99/99/9999').birthDateValid).toBe(false);
    });
  });

  describe('5. Date absente', () => {
    it('gère correctement les chaînes vides, null ou undefined', () => {
      expect(service.calculate('').birthDateValid).toBe(false);
      expect(service.calculate('   ').birthDateValid).toBe(false);
      expect(service.calculate(null).birthDateValid).toBe(false);
      expect(service.calculate(undefined).birthDateValid).toBe(false);
    });
  });

  describe('6. Fuseau horaire sans importance', () => {
    it('extrait la même date quel que soit le fuseau horaire spécifié dans l’ISO string', () => {
      const res1 = service.calculate('1986-02-22T23:30:00+04:00');
      const res2 = service.calculate('1986-02-22T01:00:00-05:00');

      expect(res1.birthDateValid).toBe(true);
      expect(res2.birthDateValid).toBe(true);
      expect(res1.birthDayNumber).toBe(22);
      expect(res2.birthDayNumber).toBe(22);
      expect(res1.lifePathNumber).toBe(3);
      expect(res2.lifePathNumber).toBe(3);
    });
  });

  describe('7. Formats ISO', () => {
    it('gère les formats ISO standards YYYY-MM-DD et ISO UTC avec zoulou', () => {
      const r1 = service.calculate('1986-02-22');
      const r2 = service.calculate('1986-02-22T00:00:00.000Z');

      expect(r1.birthDateValid).toBe(true);
      expect(r2.birthDateValid).toBe(true);
      expect(r1.birthDayNumber).toBe(22);
      expect(r2.birthDayNumber).toBe(22);
      expect(r1.lifePathNumber).toBe(3);
      expect(r2.lifePathNumber).toBe(3);
    });
  });

  describe('8. Bundle SCRIBE (buildScribeBundle)', () => {
    it('construit un bundle SCRIBE complet avec faits confirmés et calculs vérifiés', () => {
      const bundle = service.buildScribeBundle(
        {
          firstName: 'Amal',
          lastName: 'Ben',
          birthDate: '22/02/1986',
          birthPlace: 'Casablanca',
          specificQuestion: 'Quelle orientation professionnelle ?',
          objective: 'Clarté de vie',
        },
        'Focus sur la reconversion',
      );

      expect(bundle.confirmedFacts).toMatchObject({
        firstName: 'Amal',
        lastName: 'Ben',
        birthDate: '22/02/1986',
        birthPlace: 'Casablanca',
      });
      expect(bundle.verifiedCalculations).toMatchObject({
        birthDateValid: true,
        birthDayNumber: 22,
        lifePathNumber: 3,
        lifePathCalculation: '2+2+0+2+1+9+8+6=30→3',
      });
      expect(bundle.expertGuidance).toBe('Focus sur la reconversion');
      expect(bundle.clientQuestion).toBe('Quelle orientation professionnelle ?');
      expect(bundle.clientObjective).toBe('Clarté de vie');
    });
  });
});
