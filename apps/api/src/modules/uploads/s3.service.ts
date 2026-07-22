import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

export type S3BucketKind = 'uploads' | 'readings';

export interface S3ObjectResult {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
}

export interface S3ObjectMetadata {
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
  versionId?: string;
}

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private readonly logger = new Logger(S3Service.name);
  private readonly uploadBucket: string;
  private readonly readingBucket: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.uploadBucket = this.configService.get<string>(
      'AWS_UPLOADS_BUCKET_NAME',
      this.configService.get<string>('S3_UPLOAD_BUCKET'),
    );
    this.readingBucket = this.configService.get<string>(
      'AWS_S3_BUCKET_NAME',
      this.configService.get<string>('S3_READING_BUCKET'),
    );
  }

  private resolveBucket(bucket: S3BucketKind): string {
    const name = bucket === 'uploads' ? this.uploadBucket : this.readingBucket;
    if (!name) {
      throw new NotFoundException('Stockage privé indisponible');
    }
    return name;
  }

  async getUploadPresignedUrl(key: string, contentType: string, expiresInSeconds = 600) {
    const command = new PutObjectCommand({
      Bucket: this.resolveBucket('uploads'),
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  async getDownloadPresignedUrl(key: string, bucket: S3BucketKind = 'readings') {
    const command = new GetObjectCommand({
      Bucket: this.resolveBucket(bucket),
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
  }

  async getObject(key: string, bucket: S3BucketKind = 'uploads'): Promise<S3ObjectResult> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.resolveBucket(bucket),
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException('Fichier introuvable');
      }

      return {
        stream: response.Body as Readable,
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        etag: response.ETag,
        lastModified: response.LastModified,
      };
    } catch (error) {
      const name = (error as { name?: string })?.name;
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
        throw new NotFoundException('Fichier introuvable');
      }
      this.logger.error(`S3 getObject failed (${bucket})`);
      throw error;
    }
  }

  async deleteObject(key: string, bucket: S3BucketKind = 'readings'): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.resolveBucket(bucket),
          Key: key,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `S3 deleteObject failed (${bucket}/${key}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async headObject(key: string, bucket: S3BucketKind = 'uploads'): Promise<S3ObjectMetadata> {
    try {
      const response = await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.resolveBucket(bucket),
          Key: key,
        }),
      );
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        etag: response.ETag,
        lastModified: response.LastModified,
        versionId: response.VersionId,
      };
    } catch (error) {
      const name = (error as { name?: string })?.name;
      const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      if (name === 'NoSuchKey' || name === 'NotFound' || status === 404) {
        throw new NotFoundException('Fichier introuvable');
      }
      this.logger.error(`S3 headObject failed (${bucket})`);
      throw error;
    }
  }
}
