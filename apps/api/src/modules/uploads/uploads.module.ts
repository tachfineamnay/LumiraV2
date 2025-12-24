import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { UploadsController } from './uploads.controller';

@Module({
    providers: [S3Service],
    controllers: [UploadsController],
    exports: [S3Service],
})
export class UploadsModule { }
