import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { asRecord, sanitizeAmendmentData } from './profile-field-amendment.shared';

@Injectable()
export class ReadingAmendmentResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => this.sanitize(value)));
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.sanitize(entry));
    if (!this.isPlainRecord(value)) return value;

    if (value.kind === 'PALM_PHOTO' || value.kind === 'PROFILE_FIELDS') {
      return this.sanitizeAmendment(value);
    }
    if (this.isPlainRecord(value.amendment)) {
      return { ...value, amendment: this.sanitize(value.amendment) };
    }
    return value;
  }

  private sanitizeAmendment(source: Record<string, unknown>): Record<string, unknown> {
    const rawData = asRecord(source.data);
    const hasLegacyPalmPhoto =
      source.kind === 'PALM_PHOTO' && this.nonEmptyString(rawData.storageRef) !== null;
    const data = sanitizeAmendmentData(rawData);
    if (source.kind === 'PALM_PHOTO') {
      data.photoFields = hasLegacyPalmPhoto ? ['palmPhotoUrl'] : [];
    }
    return { ...source, data };
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private nonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
  }
}
