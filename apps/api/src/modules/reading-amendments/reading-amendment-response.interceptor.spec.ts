import { lastValueFrom, of } from 'rxjs';
import { ReadingAmendmentResponseInterceptor } from './reading-amendment-response.interceptor';

describe('ReadingAmendmentResponseInterceptor', () => {
  it('removes legacy palm private references and metadata', async () => {
    const interceptor = new ReadingAmendmentResponseInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept({} as never, {
        handle: () =>
          of({
            kind: 'PALM_PHOTO',
            data: {
              storageRef: 's3://onboarding/user-1/palm.jpg',
              asset: {
                key: 'onboarding/user-1/palm.jpg',
                etag: 'private-etag',
                versionId: 'private-version',
                sha256: 'private-sha',
              },
              palmRole: 'PALM_LEFT',
            },
          }),
      }),
    );

    expect(result).toMatchObject({
      kind: 'PALM_PHOTO',
      data: {
        palmRole: 'PALM_LEFT',
        photoFields: ['palmPhotoUrl'],
      },
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('s3://');
    expect(serialized).not.toContain('onboarding/user-1/');
    expect(serialized).not.toContain('private-etag');
    expect(serialized).not.toContain('private-version');
    expect(serialized).not.toContain('private-sha');
  });

  it('sanitizes nested profile amendment responses', async () => {
    const interceptor = new ReadingAmendmentResponseInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept({} as never, {
        handle: () =>
          of({
            amendment: {
              kind: 'PROFILE_FIELDS',
              data: {
                values: {
                  birthPlace: 'Paris, France',
                  facePhotoUrl: 's3://onboarding/user-1/face.jpg',
                },
                preparedAssets: {
                  face: {
                    key: 'onboarding/user-1/face.jpg',
                    sha256: 'private-sha',
                  },
                },
              },
            },
          }),
      }),
    );

    expect(result).toMatchObject({
      amendment: {
        kind: 'PROFILE_FIELDS',
        data: {
          values: { birthPlace: 'Paris, France', facePhotoUrl: null },
          photoFields: ['facePhotoUrl'],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('onboarding/user-1/');
    expect(JSON.stringify(result)).not.toContain('private-sha');
  });

  it('leaves ordinary API payloads and Date instances untouched', async () => {
    const interceptor = new ReadingAmendmentResponseInterceptor();
    const createdAt = new Date('2026-08-05T12:00:00.000Z');
    const payload = { id: 'order-1', createdAt, nested: { value: 'unchanged' } };

    const result = await lastValueFrom(
      interceptor.intercept({} as never, { handle: () => of(payload) }),
    );

    expect(result).toBe(payload);
    expect((result as typeof payload).createdAt).toBe(createdAt);
  });
});
