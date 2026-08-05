import { of, lastValueFrom } from 'rxjs';
import { ReadingAmendmentResponseInterceptor } from './reading-amendment-response.interceptor';

describe('ReadingAmendmentResponseInterceptor', () => {
  it('removes private refs from legacy palm mutation responses', async () => {
    const interceptor = new ReadingAmendmentResponseInterceptor();
    const result = await lastValueFrom(
      interceptor.intercept({} as never, {
        handle: () =>
          of({
            kind: 'PALM_PHOTO',
            data: {
              storageRef: 's3://private/user/palm.jpg',
              asset: { key: 'private-key', sha256: 'hash' },
              palmRole: 'PALM_LEFT',
            },
          }),
      }),
    );

    expect(result).toEqual({
      kind: 'PALM_PHOTO',
      data: {
        values: {},
        previousValues: {},
        photoFields: ['palmPhotoUrl'],
        palmRole: 'PALM_LEFT',
      },
    });
    expect(JSON.stringify(result)).not.toContain('s3://');
    expect(JSON.stringify(result)).not.toContain('private-key');
  });

  it('removes both profile photo refs while retaining non-sensitive values', async () => {
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
                  facePhotoUrl: 's3://private/user/face.jpg',
                },
                previousValues: {
                  birthPlace: 'Lyon, France',
                  facePhotoUrl: 's3://private/user/old-face.jpg',
                },
                faceAsset: { key: 'private-key' },
              },
            },
          }),
      }),
    );

    expect(result).toMatchObject({
      amendment: {
        kind: 'PROFILE_FIELDS',
        data: {
          values: { birthPlace: 'Paris, France' },
          previousValues: { birthPlace: 'Lyon, France' },
          photoFields: ['facePhotoUrl'],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('s3://');
    expect(JSON.stringify(result)).not.toContain('private-key');
  });
});
