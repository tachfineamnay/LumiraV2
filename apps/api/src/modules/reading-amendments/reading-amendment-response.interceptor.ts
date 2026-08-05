import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Last-line HTTP privacy guard. Amendment services keep private storage
 * references internally, while every response sent to Desk or Sanctuaire is
 * recursively stripped of storageRef and prepared asset metadata.
 */
@Injectable()
export class ReadingAmendmentResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((value) => this.sanitize(value)));
  }

  private sanitize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.sanitize(entry));
    if (!value || typeof value !== 'object') return value;

    const source = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(source).map(([key, entry]) => [key, this.sanitize(entry)]),
    );
    if (source.kind !== 'PALM_PHOTO' && source.kind !== 'PROFILE_FIELDS') {
      return result;
    }

    const data = this.asRecord(source.data);
    const values = { ...this.asRecord(data.values) };
    const previousValues = { ...this.asRecord(data.previousValues) };
    const photoFields = new Set(this.stringArray(data.photoFields));

    if (source.kind === 'PALM_PHOTO' && this.nonEmptyString(data.storageRef)) {
      photoFields.add('palmPhotoUrl');
    }
    for (const key of ['facePhotoUrl', 'palmPhotoUrl'] as const) {
      if (this.nonEmptyString(values[key])) photoFields.add(key);
      delete values[key];
      delete previousValues[key];
    }

    const safeData = { ...data, values, previousValues, photoFields: [...photoFields] };
    delete safeData.storageRef;
    delete safeData.asset;
    delete safeData.faceAsset;
    delete safeData.palmAsset;
    result.data = safeData;
    return result;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value)
      ? value.filter((entry): entry is string => typeof entry === 'string')
      : [];
  }

  private nonEmptyString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
