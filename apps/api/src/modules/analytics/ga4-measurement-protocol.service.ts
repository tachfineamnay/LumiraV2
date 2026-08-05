import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface Ga4SendResult {
  success: boolean;
  status: number;
  error?: string;
  debugValidation?: unknown;
}

@Injectable()
export class Ga4MeasurementProtocolService {
  private readonly logger = new Logger(Ga4MeasurementProtocolService.name);

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    const enabled = this.configService.get<string>('GA4_ENABLED');
    return enabled === 'true' || enabled === '1';
  }

  isDebug(): boolean {
    const debug = this.configService.get<string>('GA4_DEBUG');
    return debug === 'true' || debug === '1';
  }

  getMeasurementId(): string | undefined {
    return this.configService.get<string>('GA4_MEASUREMENT_ID');
  }

  getApiSecret(): string | undefined {
    return this.configService.get<string>('GA4_API_SECRET');
  }

  async sendGa4Event(payload: Record<string, unknown>): Promise<Ga4SendResult> {
    if (!this.isEnabled()) {
      return { success: false, status: 0, error: 'GA4_ENABLED is false' };
    }

    const measurementId = this.getMeasurementId();
    const apiSecret = this.getApiSecret();

    if (!measurementId || !apiSecret) {
      this.logger.warn('[GA4 MP] Missing GA4_MEASUREMENT_ID or GA4_API_SECRET');
      return { success: false, status: 0, error: 'Missing GA4_MEASUREMENT_ID or GA4_API_SECRET' };
    }

    const isDebug = this.isDebug();
    const endpoint = isDebug
      ? 'https://www.google-analytics.com/debug/mp/collect'
      : 'https://www.google-analytics.com/mp/collect';

    const url = `${endpoint}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`;

    try {
      const response = await axios.post(url, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 4000,
      });

      if (isDebug) {
        this.logger.log(`[GA4 MP Debug] Response: ${JSON.stringify(response.data)}`);
      }

      const success = response.status === 204 || response.status === 200;
      return {
        success,
        status: response.status,
        debugValidation: isDebug ? response.data : undefined,
      };
    } catch (err: unknown) {
      let errorMessage = 'Network error';
      let status = 500;

      if (axios.isAxiosError(err)) {
        status = err.response?.status || 500;
        errorMessage = err.response?.data
          ? typeof err.response.data === 'string'
            ? err.response.data
            : JSON.stringify(err.response.data)
          : err.message;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      this.logger.error(`[GA4 MP] Event dispatch failed (status=${status}): ${errorMessage}`);
      return { success: false, status, error: errorMessage };
    }
  }
}
