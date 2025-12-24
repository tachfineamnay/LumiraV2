import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
        this.uploadBucket = this.configService.get<string>('S3_UPLOAD_BUCKET');
        this.readingBucket = this.configService.get<string>('S3_READING_BUCKET');
    }

    async getUploadPresignedUrl(key: string, contentType: string) {
        const command = new PutObjectCommand({
            Bucket: this.uploadBucket,
            Key: key,
            ContentType: contentType,
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }

    async getDownloadPresignedUrl(key: string, bucket: 'uploads' | 'readings' = 'readings') {
        const command = new GetObjectCommand({
            Bucket: bucket === 'uploads' ? this.uploadBucket : this.readingBucket,
            Key: key,
        });
        return getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    }
}
