/**
 * @fileoverview PdfFactory - Production implementation for PDF generation.
 * Uses Handlebars for templating and Gotenberg for HTML-to-PDF conversion.
 *
 * @module services/factory/PdfFactory
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import FormData from 'form-data';

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type TemplateName = 'reading' | 'mandala' | 'ritual' | 'summary';

export interface PdfOptions {
    format?: 'A4' | 'Letter';
    orientation?: 'portrait' | 'landscape';
    margins?: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
    };
}

export interface ReadingPdfData {
    userName: string;
    archetype: string;
    archetypeDescription?: string;
    introduction: string;
    sections: {
        domain: string;
        title: string;
        content: string;
        icon?: string;
    }[];
    karmicInsights: string[];
    lifeMission: string;
    rituals: {
        name: string;
        description: string;
        instructions: string[];
    }[];
    conclusion: string;
    birthData: {
        date: string;
        time?: string;
        place?: string;
    };
    generatedAt: string;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable()
export class PdfFactory implements OnModuleInit {
    private readonly logger = new Logger(PdfFactory.name);
    private readonly templatesDir: string;
    private readonly gotenbergUrl: string;
    private layoutTemplate: Handlebars.TemplateDelegate | null = null;
    private viewTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();

    constructor(private readonly configService: ConfigService) {
        this.templatesDir = path.join(__dirname, '..', '..', 'templates');
        this.gotenbergUrl = this.configService.get<string>('GOTENBERG_URL', 'http://localhost:3002');
    }

    async onModuleInit() {
        await this.loadTemplates();
        this.registerHelpers();
        this.logger.log(`PdfFactory initialized with Gotenberg at ${this.gotenbergUrl}`);
    }

    /**
     * Generates a PDF from template name and data.
     */
    async generatePdf(
        templateName: TemplateName,
        data: ReadingPdfData,
        options?: PdfOptions,
    ): Promise<Buffer> {
        this.logger.log(`Generating PDF: ${templateName} for ${data.userName}`);

        // Step 1: Compile template to HTML
        const html = await this.compileTemplate(templateName, data);

        // Step 2: Convert HTML to PDF via Gotenberg
        const pdfBuffer = await this.convertToPdf(html, options);

        this.logger.log(`PDF generated successfully (${pdfBuffer.length} bytes)`);
        return pdfBuffer;
    }

    /**
     * Compiles a Handlebars template with provided data.
     */
    async compileTemplate(templateName: TemplateName, data: ReadingPdfData): Promise<string> {
        // Get view template
        let viewTemplate = this.viewTemplates.get(templateName);
        if (!viewTemplate) {
            await this.loadViewTemplate(templateName);
            viewTemplate = this.viewTemplates.get(templateName);
        }

        if (!viewTemplate) {
            throw new Error(`Template not found: ${templateName}`);
        }

        // Compile view with data
        const bodyContent = viewTemplate(data);

        // Compile layout with body
        if (!this.layoutTemplate) {
            await this.loadLayoutTemplate();
        }

        const finalHtml = this.layoutTemplate!({
            title: `Oracle Lumira - ${data.userName || 'Lecture'}`,
            subtitle: 'Lecture Spirituelle Personnalisée',
            year: new Date().getFullYear(),
            userName: data.userName,
            body: bodyContent,
        });

        return finalHtml;
    }

    /**
     * Converts HTML to PDF via Gotenberg.
     */
    async convertToPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
        const formData = new FormData();

        // Add the HTML file
        formData.append('files', Buffer.from(html, 'utf-8'), {
            filename: 'index.html',
            contentType: 'text/html',
        });

        // Configure PDF options
        formData.append('paperWidth', '8.27'); // A4 width in inches
        formData.append('paperHeight', '11.69'); // A4 height in inches
        formData.append('marginTop', options.margins?.top || '0.5');
        formData.append('marginBottom', options.margins?.bottom || '0.5');
        formData.append('marginLeft', options.margins?.left || '0.5');
        formData.append('marginRight', options.margins?.right || '0.5');
        formData.append('printBackground', 'true');
        formData.append('preferCssPageSize', 'false');

        try {
            const response = await axios.post(
                `${this.gotenbergUrl}/forms/chromium/convert/html`,
                formData,
                {
                    headers: formData.getHeaders(),
                    responseType: 'arraybuffer',
                    timeout: 60000, // 60 seconds timeout
                },
            );

            return Buffer.from(response.data);
        } catch (error) {
            this.logger.error(`Gotenberg conversion failed: ${error}`);
            throw new Error(`PDF conversion failed: ${error}`);
        }
    }

    // ===========================================================================
    // PRIVATE METHODS
    // ===========================================================================

    private async loadTemplates(): Promise<void> {
        try {
            await this.loadLayoutTemplate();
            await this.loadViewTemplate('reading');
            this.logger.log('Templates loaded successfully');
        } catch (error) {
            this.logger.warn(`Could not preload templates: ${error}`);
        }
    }

    private async loadLayoutTemplate(): Promise<void> {
        const layoutPath = path.join(this.templatesDir, 'layouts', 'main.hbs');
        try {
            const layoutSource = await fs.readFile(layoutPath, 'utf-8');
            this.layoutTemplate = Handlebars.compile(layoutSource);
        } catch (error) {
            this.logger.error(`Failed to load layout template: ${error}`);
            // Use fallback inline layout
            this.layoutTemplate = Handlebars.compile(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <title>{{title}}</title>
          <style>
            body { font-family: Georgia, serif; padding: 40px; line-height: 1.6; }
            h1 { color: #1a202c; text-align: center; }
          </style>
        </head>
        <body>{{{body}}}</body>
        </html>
      `);
        }
    }

    private async loadViewTemplate(name: string): Promise<void> {
        const viewPath = path.join(this.templatesDir, 'views', `${name}.hbs`);
        try {
            const viewSource = await fs.readFile(viewPath, 'utf-8');
            this.viewTemplates.set(name, Handlebars.compile(viewSource));
        } catch (error) {
            this.logger.error(`Failed to load view template ${name}: ${error}`);
            throw error;
        }
    }

    private registerHelpers(): void {
        // Date formatting helper
        Handlebars.registerHelper('formatDate', (date: string | Date) => {
            if (!date) return '';
            const d = new Date(date);
            return d.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        });

        // Domain icon helper
        Handlebars.registerHelper('domainIcon', (domain: string) => {
            const icons: Record<string, string> = {
                spirituel: '✨',
                relations: '💕',
                mission: '🎯',
                creativite: '🎨',
                emotions: '💫',
                travail: '💼',
                sante: '🌿',
                finance: '💰',
            };
            return icons[domain] || '🔮';
        });

        // Capitalize helper
        Handlebars.registerHelper('capitalize', (str: string) => {
            if (!str) return '';
            return str.charAt(0).toUpperCase() + str.slice(1);
        });

        // Index helper (1-based)
        Handlebars.registerHelper('inc', (value: number) => value + 1);

        // Conditional equals helper
        Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    }
}
