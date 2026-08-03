import {
  BadRequestException,
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Get,
  Query,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { execFile } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import sharp from 'sharp';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CreateOnboardingPhotoDto } from '../users/dto/update-profile.dto';

const MAX_SOURCE_PHOTO_BYTES = 30 * 1024 * 1024;
const MAX_NORMALIZED_PHOTO_BYTES = 1_200_000;
const MAX_INPUT_PIXELS = 40_000_000;
const HEIF_CONVERT_TIMEOUT_MS = 25_000;
const execFileAsync = promisify(execFile);

type UploadedPhoto = {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size: number;
};

type PhotoKind = 'FACE' | 'PALM';

async function normalizeWithSharp(input: Buffer): Promise<Buffer> {
  const metadata = await sharp(input, {
    failOn: 'error',
    limitInputPixels: MAX_INPUT_PIXELS,
  }).metadata();

  if (!metadata.width || !metadata.height) {
    throw new BadRequestException('Le fichier ne contient pas une image exploitable');
  }

  let maxEdge = 1600;
  let quality = 88;
  let normalized = Buffer.alloc(0);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    normalized = await sharp(input, {
      failOn: 'error',
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .flatten({ background: '#ffffff' })
      .jpeg({
        quality,
        mozjpeg: true,
        chromaSubsampling: '4:2:0',
      })
      .toBuffer();

    if (normalized.length <= MAX_NORMALIZED_PHOTO_BYTES) return normalized;

    maxEdge = Math.max(760, Math.floor(maxEdge * 0.82));
    quality = Math.max(58, quality - 7);
  }

  throw new BadRequestException(
    "L'image reste trop volumineuse après conversion. Choisissez une image moins complexe.",
  );
}

async function convertHeifToJpeg(input: Buffer): Promise<Buffer> {
  const directory = await mkdtemp(join(tmpdir(), 'lumira-heif-'));
  const inputPath = join(directory, 'source.heic');
  const outputPath = join(directory, 'converted.jpg');

  try {
    await writeFile(inputPath, input, { mode: 0o600 });
    await execFileAsync('heif-convert', [inputPath, outputPath], {
      timeout: HEIF_CONVERT_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });

    const generatedFiles = await readdir(directory);
    const generatedName =
      generatedFiles.find((name) => name === 'converted.jpg') ??
      generatedFiles.find((name) => name.startsWith('converted-') && name.endsWith('.jpg'));

    if (!generatedName) throw new Error('HEIF conversion produced no JPEG');
    const converted = await readFile(join(directory, generatedName));
    if (!converted.length) throw new Error('HEIF conversion produced an empty JPEG');
    return converted;
  } finally {
    await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function normalizePhoto(input: Buffer): Promise<Buffer> {
  try {
    return await normalizeWithSharp(input);
  } catch (sharpError) {
    if (sharpError instanceof BadRequestException) throw sharpError;

    try {
      const convertedHeif = await convertHeifToJpeg(input);
      return await normalizeWithSharp(convertedHeif);
    } catch (heifError) {
      if (heifError instanceof BadRequestException) throw heifError;
      throw new BadRequestException(
        "Ce fichier n'a pas pu être décodé comme une image. Il est peut-être corrompu ou utilise un format photo non pris en charge.",
      );
    }
  }
}

@Controller('uploads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UploadsController {
  constructor(private readonly s3Service: S3Service) {}

  @Roles('CLIENT')
  @Post('onboarding-normalize')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        files: 1,
        fileSize: MAX_SOURCE_PHOTO_BYTES,
      },
    }),
  )
  async normalizeOnboardingPhoto(
    @Request() req: { user: { userId: string } },
    @UploadedFile() file: UploadedPhoto | undefined,
    @Body('kind') rawKind: string | undefined,
  ) {
    const kind = rawKind?.toUpperCase() as PhotoKind | undefined;
    if (kind !== 'FACE' && kind !== 'PALM') {
      throw new BadRequestException('Type de photo invalide');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('Aucun fichier image reçu');
    }
    if (file.size > MAX_SOURCE_PHOTO_BYTES) {
      throw new BadRequestException('La photo source dépasse 30 Mo');
    }

    const normalized = await normalizePhoto(file.buffer);
    const key = `onboarding/${req.user.userId}/${kind.toLowerCase()}-${randomUUID()}.jpg`;
    await this.s3Service.putObject(key, normalized, 'image/jpeg', 'uploads');

    return {
      key,
      storageRef: `s3://${key}`,
      contentType: 'image/jpeg',
      normalizedBytes: normalized.length,
    };
  }

  @Roles('CLIENT')
  @Post('onboarding-presign')
  async getOnboardingPhotoPresign(
    @Request() req: { user: { userId: string } },
    @Body() body: CreateOnboardingPhotoDto,
  ) {
    const extensionByMime = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    } as const;
    const extension = extensionByMime[body.contentType];
    if (!extension) {
      throw new BadRequestException('Format de photo non autorisé');
    }

    const key = `onboarding/${req.user.userId}/${body.kind.toLowerCase()}-${randomUUID()}.${extension}`;
    const expiresIn = 600;
    const uploadUrl = await this.s3Service.getUploadPresignedUrl(key, body.contentType, expiresIn);
    return { uploadUrl, key, storageRef: `s3://${key}`, expiresIn };
  }

  @Roles('CLIENT')
  @Post('presign')
  async getPresignUrl(@Body() body: { fileName: string; contentType: string; orderId: string }) {
    const key = `orders/${body.orderId}/${Date.now()}-${body.fileName}`;
    const url = await this.s3Service.getUploadPresignedUrl(key, body.contentType);
    return { url, key };
  }

  // Client media has dedicated ownership-checked routes. This legacy generic
  // signer remains available to the Desk only; a client must never turn an
  // arbitrary object key into a private download URL.
  @Roles('EXPERT', 'ADMIN')
  @Get('signed-url')
  async getSignedUrl(
    @Query('key') key: string,
    @Query('bucket') bucket: 'uploads' | 'readings' = 'readings',
  ) {
    const url = await this.s3Service.getDownloadPresignedUrl(key, bucket);
    return { url };
  }
}
