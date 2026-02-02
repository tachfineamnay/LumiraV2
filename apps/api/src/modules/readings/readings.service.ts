import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class ReadingsService {
    private readonly logger = new Logger(ReadingsService.name);
    private readonly s3Client: S3Client;
    private readonly s3Bucket: string;
    private readonly s3Region: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {
        this.s3Region = this.configService.get<string>('AWS_REGION', 'eu-west-3');
        // Use AWS_LECTURES_BUCKET_NAME from environment
        this.s3Bucket = this.configService.get<string>(
            'AWS_LECTURES_BUCKET_NAME',
            this.configService.get<string>('AWS_S3_BUCKET_NAME', 'oracle-lumira-lectures'),
        );

        this.s3Client = new S3Client({
            region: this.s3Region,
            credentials: {
                accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
                secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
            },
        });

        this.logger.log(`ReadingsService initialized with bucket: ${this.s3Bucket}`);
    }

    /**
     * Get signed URL for PDF download by order number
     * @param orderNumber - The order number (e.g., LU260202001)
     * @param userId - Optional user ID for authorization (if null, any user can access)
     */
    async getPdfSignedUrl(orderNumber: string, userId?: string): Promise<{ url: string; filename: string }> {
        this.logger.log(`📄 Getting PDF URL for order: ${orderNumber}`);

        // Find the order by orderNumber
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: {
                id: true,
                orderNumber: true,
                userId: true,
                status: true,
                generatedContent: true,
            },
        });

        if (!order) {
            this.logger.warn(`Order not found: ${orderNumber}`);
            throw new NotFoundException(`Commande non trouvée: ${orderNumber}`);
        }

        // If userId provided, verify access
        if (userId && order.userId !== userId) {
            this.logger.warn(`User ${userId} tried to access order ${orderNumber} belonging to user ${order.userId}`);
            throw new NotFoundException('Lecture non trouvée');
        }

        // Check if order has PDF
        const content = order.generatedContent as Record<string, unknown> | null;
        if (!content) {
            this.logger.warn(`Order ${orderNumber} has no generated content`);
            throw new NotFoundException('Aucun contenu généré pour cette commande');
        }

        // Get PDF key from content
        let pdfKey = content.pdfKey as string | undefined;
        
        // If no pdfKey, try to extract from pdfUrl
        if (!pdfKey && content.pdfUrl) {
            const pdfUrl = content.pdfUrl as string;
            // If it's an S3 URL, extract the key
            if (pdfUrl.includes('s3.') && pdfUrl.includes('.amazonaws.com/')) {
                pdfKey = pdfUrl.split('.amazonaws.com/')[1];
            } else if (!pdfUrl.startsWith('http')) {
                // It's a relative path like /api/readings/xxx/download
                // In this case, we need to find the PDF in S3 by order number
                pdfKey = `readings/${orderNumber}`;
            }
        }

        // Try to find PDF in S3 by constructing expected key pattern
        if (!pdfKey) {
            pdfKey = `readings/${orderNumber}`;
            this.logger.log(`📂 No pdfKey stored, trying pattern: ${pdfKey}/*`);
        }

        this.logger.log(`🔑 PDF Key: ${pdfKey}`);

        // If the key doesn't end with .pdf, search for the PDF in S3
        let finalPdfKey = pdfKey;
        if (!pdfKey.endsWith('.pdf')) {
            this.logger.log(`🔍 Searching for PDF files in ${pdfKey}/...`);
            
            try {
                // List objects in the readings folder to find the actual PDF file
                const listCommand = new ListObjectsV2Command({
                    Bucket: this.s3Bucket,
                    Prefix: pdfKey.endsWith('/') ? pdfKey : `${pdfKey}/`,
                    MaxKeys: 10,
                });
                
                const listResult = await this.s3Client.send(listCommand);
                
                if (listResult.Contents && listResult.Contents.length > 0) {
                    // Find the first PDF file
                    const pdfFile = listResult.Contents.find(obj => obj.Key?.endsWith('.pdf'));
                    if (pdfFile?.Key) {
                        finalPdfKey = pdfFile.Key;
                        this.logger.log(`✅ Found PDF: ${finalPdfKey}`);
                    } else {
                        this.logger.warn(`⚠️ No PDF found in ${pdfKey}/, files: ${listResult.Contents.map(c => c.Key).join(', ')}`);
                    }
                } else {
                    this.logger.warn(`⚠️ No files found in S3 with prefix: ${pdfKey}/`);
                }
            } catch (listError) {
                this.logger.error(`❌ Error listing S3 objects: ${listError}`);
            }
        }

        try {
            // Generate signed URL (1 hour expiry)
            const command = new GetObjectCommand({
                Bucket: this.s3Bucket,
                Key: finalPdfKey,
            });

            const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });

            this.logger.log(`✅ Generated signed URL for ${finalPdfKey}`);

            return {
                url: signedUrl,
                filename: `Lecture_${orderNumber}.pdf`,
            };
        } catch (error) {
            this.logger.error(`❌ Error generating signed URL: ${error}`);
            
            // Try to list objects in the readings folder to find the PDF
            throw new NotFoundException('PDF non disponible. Le fichier n\'a peut-être pas encore été généré.');
        }
    }

    /**
     * Stream PDF directly from S3
     */
    async getPdfStream(orderNumber: string): Promise<{
        stream: ReadableStream | NodeJS.ReadableStream;
        contentType: string;
        contentLength?: number;
    }> {
        const order = await this.prisma.order.findUnique({
            where: { orderNumber },
            select: {
                generatedContent: true,
            },
        });

        if (!order?.generatedContent) {
            throw new NotFoundException('PDF non trouvé');
        }

        const content = order.generatedContent as Record<string, unknown>;
        const pdfKey = content.pdfKey as string;

        if (!pdfKey) {
            throw new NotFoundException('PDF non disponible');
        }

        const command = new GetObjectCommand({
            Bucket: this.s3Bucket,
            Key: pdfKey,
        });

        const response = await this.s3Client.send(command);

        return {
            stream: response.Body as NodeJS.ReadableStream,
            contentType: 'application/pdf',
            contentLength: response.ContentLength,
        };
    }
}
