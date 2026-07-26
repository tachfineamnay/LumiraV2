import zlib from 'zlib';
import {
  IDENTIFIABLE_VISION_PROBE_BASE64,
  sanitizeVisionResponsePreview,
} from './ai-provider-diagnostics.utils';

describe('ai-provider-diagnostics.utils — PNG image validity', () => {
  it('decodes Base64 and verifies valid PNG header magic bytes', () => {
    const buffer = Buffer.from(IDENTIFIABLE_VISION_PROBE_BASE64, 'base64');
    expect(buffer.length).toBeGreaterThan(0);

    const pngHeader = buffer.slice(0, 8).toString('hex');
    expect(pngHeader).toBe('89504e470d0a1a0a');
  });

  it('verifies dimensions 512x512 from IHDR chunk', () => {
    const buffer = Buffer.from(IDENTIFIABLE_VISION_PROBE_BASE64, 'base64');
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);

    expect(width).toBe(512);
    expect(height).toBe(512);
  });

  it('verifies PNG buffer is complete, not truncated, and has valid IDAT checksums', () => {
    const buffer = Buffer.from(IDENTIFIABLE_VISION_PROBE_BASE64, 'base64');

    let offset = 8;
    const idatChunks: Buffer[] = [];

    while (offset < buffer.length) {
      const chunkLen = buffer.readUInt32BE(offset);
      const chunkType = buffer.toString('ascii', offset + 4, offset + 8);
      const chunkData = buffer.slice(offset + 8, offset + 8 + chunkLen);

      if (chunkType === 'IDAT') {
        idatChunks.push(chunkData);
      }

      offset += 12 + chunkLen;
      if (chunkType === 'IEND') break;
    }

    expect(offset).toBeLessThanOrEqual(buffer.length);
    expect(idatChunks.length).toBeGreaterThan(0);
    const compressed = Buffer.concat(idatChunks);
    expect(() => zlib.inflateSync(compressed)).not.toThrow();

    const decompressed = zlib.inflateSync(compressed);
    // 512 rows, each row has 1 filter byte + 512 * 3 RGB bytes = 1537 bytes per row. Total: 512 * 1537 = 786944 bytes.
    expect(decompressed.length).toBe(512 * (1 + 512 * 3));
  });

  it('sanitizes vision response preview up to 200 chars without control characters', () => {
    const raw = '  circle=red\n\x07\x1F;square=blue;number=27  ' + 'x'.repeat(300);
    const sanitized = sanitizeVisionResponsePreview(raw);

    expect(sanitized.length).toBeLessThanOrEqual(200);
    expect(sanitized).not.toMatch(/[\x00-\x1F\x7F]/);
    expect(sanitized).toContain('circle=red');
  });
});
