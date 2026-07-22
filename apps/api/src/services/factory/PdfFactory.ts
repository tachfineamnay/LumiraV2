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
  keywords?: string[];
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
    this.gotenbergUrl = this.configService
      .get<string>('GOTENBERG_URL', 'http://localhost:3002')
      .replace(/\/+$/, '');
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
   *
   * A new multipart form is created for every attempt. Node form-data streams
   * are one-shot; reusing the same instance made all retries after the first
   * network failure invalid or empty.
   */
  async convertToPdf(html: string, options: PdfOptions = {}): Promise<Buffer> {
    this.logger.log(`📄 Starting PDF conversion via Gotenberg at ${this.gotenbergUrl}`);
    const startTime = Date.now();
    const gotenbergTimeout = this.configService.get<number>('GOTENBERG_TIMEOUT_MS', 45_000);
    const maxRetries = this.configService.get<number>('GOTENBERG_MAX_ATTEMPTS', 2);
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const formData = this.createConversionForm(html, options);

      try {
        this.logger.log(`📄 Gotenberg attempt ${attempt}/${maxRetries}...`);

        const response = await axios.post(
          `${this.gotenbergUrl}/forms/chromium/convert/html`,
          formData,
          {
            headers: formData.getHeaders(),
            responseType: 'arraybuffer',
            timeout: gotenbergTimeout,
            maxContentLength: 25 * 1024 * 1024,
            maxBodyLength: 25 * 1024 * 1024,
          },
        );

        const pdfBuffer = Buffer.from(response.data);
        this.assertPdfBuffer(pdfBuffer);

        const elapsed = Date.now() - startTime;
        this.logger.log(`✅ PDF generated in ${elapsed}ms (${pdfBuffer.length} bytes)`);
        return pdfBuffer;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const retryable = this.isRetryableGotenbergError(error);

        if (axios.isAxiosError(error)) {
          this.logger.error(`❌ Gotenberg error: ${error.code || 'HTTP'} - ${error.message}`);
          if (error.response) {
            this.logger.error(`   Status: ${error.response.status}`);
            this.logger.error(
              `   Data: ${Buffer.from(error.response.data || '').toString().substring(0, 500)}`,
            );
          }
        } else {
          this.logger.error(`❌ Gotenberg conversion failed: ${lastError.message}`);
        }

        if (!retryable || attempt >= maxRetries) break;

        const delay = attempt * 1500;
        this.logger.log(`⏳ Retrying Gotenberg in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error(
      `PDF conversion failed after ${maxRetries} attempt(s): ${lastError?.message || 'unknown error'}`,
    );
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private createConversionForm(html: string, options: PdfOptions): FormData {
    const formData = new FormData();
    formData.append('files', Buffer.from(html, 'utf-8'), {
      filename: 'index.html',
      contentType: 'text/html; charset=utf-8',
    });

    const format = options.format ?? 'A4';
    let paperWidth = format === 'Letter' ? 8.5 : 8.27;
    let paperHeight = format === 'Letter' ? 11 : 11.69;
    if (options.orientation === 'landscape') {
      [paperWidth, paperHeight] = [paperHeight, paperWidth];
    }

    formData.append('paperWidth', String(paperWidth));
    formData.append('paperHeight', String(paperHeight));
    formData.append('marginTop', options.margins?.top || '0.5');
    formData.append('marginBottom', options.margins?.bottom || '0.5');
    formData.append('marginLeft', options.margins?.left || '0.5');
    formData.append('marginRight', options.margins?.right || '0.5');
    formData.append('printBackground', 'true');
    formData.append('preferCssPageSize', 'false');
    return formData;
  }

  private assertPdfBuffer(pdfBuffer: Buffer): void {
    if (pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new Error('Gotenberg returned a payload that is not a valid PDF');
    }
  }

  private isRetryableGotenbergError(error: unknown): boolean {
    if (!axios.isAxiosError(error)) return true;
    const status = error.response?.status;
    if (!status) return true;
    return status === 408 || status === 429 || status >= 500;
  }

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

    Handlebars.registerHelper('sectionNumber', (index: number, introduction: unknown) => {
      return index + (typeof introduction === 'string' && introduction.trim() ? 2 : 1);
    });

    // Turns validated plain text into readable PDF paragraphs without allowing
    // customer content to introduce arbitrary HTML into the document.
    Handlebars.registerHelper('richText', (value: unknown) => {
      if (typeof value !== 'string' || !value.trim()) {
        return new Handlebars.SafeString('');
      }

      const paragraphs = value
        .trim()
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => Handlebars.Utils.escapeExpression(paragraph.trim()))
        .filter(Boolean)
        .map((paragraph) => `<p>${paragraph.replace(/\r?\n/g, '<br>')}</p>`);

      return new Handlebars.SafeString(paragraphs.join(''));
    });

    // Conditional equals helper
    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  }
}
