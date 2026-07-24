import { Injectable, Logger } from '@nestjs/common';

export interface VerifiedReadingCalculations {
  birthDayNumber: number | null;
  lifePathNumber: number | null;
  lifePathCalculation: string | null;
  birthDateValid: boolean;
  astrologicalSign: string | null;
}

export interface ScribeBundle {
  confirmedFacts: Record<string, unknown>;
  verifiedCalculations: VerifiedReadingCalculations;
  expertGuidance?: string | null;
  visualInputs: {
    facePhotoUrl?: string | null;
    palmPhotoUrl?: string | null;
  };
  clientQuestion?: string | null;
  clientObjective?: string | null;
}

const MASTER_NUMBERS = new Set([11, 22, 33]);

@Injectable()
export class ReadingCalculationsService {
  private readonly logger = new Logger(ReadingCalculationsService.name);

  /**
   * Calculate verified numerological indicators from a raw birthDate string.
   */
  calculate(birthDate?: string | null): VerifiedReadingCalculations {
    if (!birthDate || typeof birthDate !== 'string' || !birthDate.trim()) {
      return {
        birthDayNumber: null,
        lifePathNumber: null,
        lifePathCalculation: null,
        birthDateValid: false,
        astrologicalSign: null,
      };
    }

    const parsed = this.parseDateParts(birthDate.trim());
    if (!parsed) {
      this.logger.warn(`[ReadingCalculations] Invalid birth date provided: "${birthDate}"`);
      return {
        birthDayNumber: null,
        lifePathNumber: null,
        lifePathCalculation: null,
        birthDateValid: false,
        astrologicalSign: null,
      };
    }

    const { year, month, day } = parsed;

    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const yearStr = String(year).padStart(4, '0');

    const digitsStr = `${dayStr}${monthStr}${yearStr}`;
    const digits = digitsStr.split('').map(Number);
    const initialSum = digits.reduce((acc, curr) => acc + curr, 0);

    const steps: number[] = [initialSum];
    let current = initialSum;

    while (current > 9 && !MASTER_NUMBERS.has(current)) {
      current = String(current)
        .split('')
        .map(Number)
        .reduce((acc, c) => acc + c, 0);
      steps.push(current);
    }

    const calculationStr = `${digits.join('+')}=${steps.join('→')}`;

    const result: VerifiedReadingCalculations = {
      birthDayNumber: day,
      lifePathNumber: current,
      lifePathCalculation: calculationStr,
      birthDateValid: true,
      astrologicalSign: null, // No unverified astrological calculation per requirements
    };

    this.logger.log(
      `[ReadingCalculations] Date: ${yearStr}-${monthStr}-${dayStr} | Day: ${day} | LifePath: ${current} (${calculationStr})`,
    );

    return result;
  }

  /**
   * Build the complete bundle passed to SCRIBE.
   */
  buildScribeBundle(
    profile: {
      firstName?: string;
      lastName?: string;
      birthDate?: string;
      usageName?: string;
      birthTime?: string;
      birthPlace?: string;
      specificQuestion?: string;
      objective?: string;
      facePhotoUrl?: string;
      palmPhotoUrl?: string;
      [key: string]: unknown;
    },
    expertGuidance?: string,
  ): ScribeBundle {
    const verifiedCalculations = this.calculate(profile?.birthDate);

    const confirmedFacts: Record<string, unknown> = {};
    if (profile.firstName) confirmedFacts.firstName = profile.firstName;
    if (profile.lastName) confirmedFacts.lastName = profile.lastName;
    if (profile.usageName) confirmedFacts.usageName = profile.usageName;
    if (profile.birthDate) confirmedFacts.birthDate = profile.birthDate;
    if (profile.birthTime) confirmedFacts.birthTime = profile.birthTime;
    if (profile.birthPlace) confirmedFacts.birthPlace = profile.birthPlace;

    return {
      confirmedFacts,
      verifiedCalculations,
      expertGuidance: expertGuidance || null,
      visualInputs: {
        facePhotoUrl: profile.facePhotoUrl || null,
        palmPhotoUrl: profile.palmPhotoUrl || null,
      },
      clientQuestion: profile.specificQuestion || null,
      clientObjective: profile.objective || null,
    };
  }

  /**
   * Parse date into year, month (1-12), day (1-31) in a timezone-independent manner.
   */
  private parseDateParts(raw: string): { year: number; month: number; day: number } | null {
    // 1. Format YYYY-MM-DD or ISO string (e.g. 1986-02-22 or 1986-02-22T14:30:00+02:00)
    const isoMatch = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
    if (isoMatch) {
      const year = Number.parseInt(isoMatch[1], 10);
      const month = Number.parseInt(isoMatch[2], 10);
      const day = Number.parseInt(isoMatch[3], 10);
      if (this.isValidDate(year, month, day)) {
        return { year, month, day };
      }
    }

    // 2. Format DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (dmyMatch) {
      const day = Number.parseInt(dmyMatch[1], 10);
      const month = Number.parseInt(dmyMatch[2], 10);
      const year = Number.parseInt(dmyMatch[3], 10);
      if (this.isValidDate(year, month, day)) {
        return { year, month, day };
      }
    }

    // 3. Fallback: JS Date parsing without timezone shift
    const datePortion = raw.includes('T') ? raw.split('T')[0] : raw;
    const parts = datePortion.split(/[/.-]/);
    if (parts.length === 3) {
      const p1 = Number.parseInt(parts[0], 10);
      const p2 = Number.parseInt(parts[1], 10);
      const p3 = Number.parseInt(parts[2], 10);
      if (!Number.isNaN(p1) && !Number.isNaN(p2) && !Number.isNaN(p3)) {
        if (p1 > 31) {
          // YYYY-MM-DD
          if (this.isValidDate(p1, p2, p3)) return { year: p1, month: p2, day: p3 };
        } else if (p3 > 31) {
          // DD-MM-YYYY
          if (this.isValidDate(p3, p2, p1)) return { year: p3, month: p2, day: p1 };
        }
      }
    }

    return null;
  }

  private isValidDate(year: number, month: number, day: number): boolean {
    if (year < 1850 || year > 2150) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return day <= daysInMonth;
  }
}
