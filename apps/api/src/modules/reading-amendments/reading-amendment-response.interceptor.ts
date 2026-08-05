import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Last-line HTTP privacy guard. It deliberately ignores every ordinary API
 * response and only sanitizes amendment objects or an `amendment` property.
 */
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
    return { ...source, data: safeData };
  }

  private isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return this.isPlainRecord(value) ? value : {};
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
