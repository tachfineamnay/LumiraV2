import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadingsService } from './readings.service';

describe('ReadingsService private audio', () => {
  let service: ReadingsService;
  let prisma: { order: { findUnique: jest.Mock } };
  let s3Client: { send: jest.Mock };

  beforeEach(() => {
    prisma = { order: { findUnique: jest.fn() } };
    service = new ReadingsService(
      { get: jest.fn((_key: string, fallback?: string) => fallback) } as unknown as ConfigService,
      prisma as unknown as PrismaService,
    );
    s3Client = { send: jest.fn() };
    (service as unknown as { s3Client: typeof s3Client }).s3Client = s3Client;
  });

  it('checks ownership then forwards a byte range to private object storage', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'client-1',
      files: [{ key: 'orders/order-1/reading.mp3', contentType: 'audio/mpeg' }],
    });
    s3Client.send.mockResolvedValue({
      Body: Readable.from(['audio']),
      ContentType: 'audio/mpeg',
      ContentLength: 5,
      ContentRange: 'bytes 0-4/5',
    });

    const result = await service.getAudioStream('LUM-001', 'client-1', 'bytes=0-4');

    expect(result.contentRange).toBe('bytes 0-4/5');
    expect(s3Client.send).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ Key: 'orders/order-1/reading.mp3', Range: 'bytes=0-4' }),
      }),
    );
  });

  it('does not call storage when the requested order belongs to another client', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      userId: 'another-client',
      files: [],
    });

    await expect(service.getAudioStream('LUM-001', 'client-1')).rejects.toThrow(NotFoundException);
    expect(s3Client.send).not.toHaveBeenCalled();
  });
});
