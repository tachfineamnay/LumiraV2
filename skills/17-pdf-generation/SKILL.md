---
name: PDF Generation (PdfFactory)
description: HTML-to-PDF generation using Handlebars templates and Gotenberg.
---

# PDF Generation (PdfFactory)

## Context

Oracle Lumira generates personalized PDF readings using:
- **Handlebars** for HTML templating
- **Gotenberg** for HTML-to-PDF conversion

**Service Location**: `apps/api/src/services/factory/PdfFactory.ts`
**Templates**: `apps/api/src/templates/`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PDF GENERATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ VertexAI │───▶│  Compile │───▶│ Gotenberg│───▶│   S3     │ │
│  │ Content  │    │ Template │    │  PDF     │    │  Upload  │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│       │                                               │         │
│       │         ┌────────────────────────────────────┘         │
│       ▼         ▼                                              │
│  ┌──────────────────────┐                                      │
│  │   Order.generatedContent                                    │
│  │   { pdfUrl: "s3://..." }                                    │
│  └──────────────────────┘                                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Template Structure

```
apps/api/src/templates/
├── layouts/
│   └── base.hbs           # Base HTML layout
├── partials/
│   ├── header.hbs         # Document header
│   ├── footer.hbs         # Page footer
│   └── section.hbs        # Content section block
└── views/
    ├── reading.hbs        # Main reading template
    ├── ritual.hbs         # Ritual card template
    └── summary.hbs        # Quick summary template
```

---

## PdfFactory Service

```typescript
// apps/api/src/services/factory/PdfFactory.ts
@Injectable()
export class PdfFactory implements OnModuleInit {
  private readonly logger = new Logger(PdfFactory.name);
  private readonly templatesDir: string;
  private readonly gotenbergUrl: string;
  private layoutTemplate: Handlebars.TemplateDelegate | null = null;
  private viewTemplates: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.templatesDir = path.join(__dirname, '..', '..', 'templates');
    this.gotenbergUrl = this.configService.get<string>(
      'GOTENBERG_URL', 
      'http://localhost:3002'
    );
  }

  async onModuleInit() {
    await this.loadTemplates();
    this.registerHelpers();
    this.logger.log(`PdfFactory initialized with Gotenberg at ${this.gotenbergUrl}`);
  }
}
```

---

## Template Types

```typescript
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
```

---

## Data Interface

```typescript
export interface ReadingPdfData {
  // User info
  userName: string;
  birthData: {
    date: string;
    time?: string;
    place?: string;
  };
  
  // Content from VertexOracle
  archetype: string;
  archetypeDescription?: string;
  introduction: string;
  sections: {
    domain: string;    // spirituel, relations, mission, etc.
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
  
  // Metadata
  generatedAt: string;
}
```

---

## Generating a PDF

```typescript
// Usage in DigitalSoulService or OrdersService
async generateReadingPdf(orderId: string): Promise<string> {
  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });

  // 1. Get AI content from order
  const aiContent = order.generatedContent as OracleResponse;

  // 2. Transform to PDF data
  const pdfData: ReadingPdfData = {
    userName: order.userName,
    archetype: aiContent.synthesis.archetype,
    introduction: aiContent.pdf_content.introduction,
    sections: aiContent.pdf_content.sections,
    karmicInsights: aiContent.pdf_content.karmic_insights,
    lifeMission: aiContent.pdf_content.life_mission,
    rituals: aiContent.pdf_content.rituals,
    conclusion: aiContent.pdf_content.conclusion,
    birthData: {
      date: order.formData.birthDate,
      time: order.formData.birthTime,
      place: order.formData.birthPlace,
    },
    generatedAt: new Date().toISOString(),
  };

  // 3. Generate PDF buffer
  const pdfBuffer = await this.pdfFactory.generatePdf('reading', pdfData, {
    format: 'A4',
    margins: { top: '20mm', bottom: '20mm' },
  });

  // 4. Upload to S3
  const pdfUrl = await this.uploadsService.uploadPdf(
    pdfBuffer,
    `readings/${orderId}.pdf`
  );

  // 5. Update order with PDF URL
  await this.prisma.order.update({
    where: { id: orderId },
    data: {
      generatedContent: {
        ...order.generatedContent,
        pdfUrl,
      },
    },
  });

  return pdfUrl;
}
```

---

## Handlebars Helpers

```typescript
// PdfFactory.registerHelpers()
private registerHelpers() {
  // Format date
  Handlebars.registerHelper('formatDate', (date: string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  // Domain icon mapping
  Handlebars.registerHelper('domainIcon', (domain: string) => {
    const icons: Record<string, string> = {
      spirituel: '🔮',
      relations: '💕',
      mission: '🎯',
      creativite: '✨',
      emotions: '💫',
      travail: '💼',
      sante: '🌿',
      finance: '💰',
    };
    return icons[domain] || '•';
  });

  // Numbered list
  Handlebars.registerHelper('numberList', function(items: string[], options) {
    return items.map((item, i) => 
      `<li>${i + 1}. ${item}</li>`
    ).join('');
  });
}
```

---

## Gotenberg Integration

```typescript
async convertToPdf(html: string, options?: PdfOptions): Promise<Buffer> {
  const formData = new FormData();
  
  // Add HTML content
  formData.append('files', Buffer.from(html), {
    filename: 'index.html',
    contentType: 'text/html',
  });

  // Add options
  formData.append('paperWidth', '8.27');  // A4 width in inches
  formData.append('paperHeight', '11.69'); // A4 height
  formData.append('marginTop', options?.margins?.top || '0.5');
  formData.append('marginBottom', options?.margins?.bottom || '0.5');

  const response = await axios.post(
    `${this.gotenbergUrl}/forms/chromium/convert/html`,
    formData,
    {
      headers: formData.getHeaders(),
      responseType: 'arraybuffer',
    }
  );

  return Buffer.from(response.data);
}
```

---

## Template Example

```handlebars
{{!-- views/reading.hbs --}}
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: 'Crimson Pro', Georgia, serif;
      color: #1a1a2e;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      padding: 40px 0;
      border-bottom: 2px solid #E8A838;
    }
    .archetype-badge {
      background: linear-gradient(135deg, #E8A838, #F4B942);
      color: white;
      padding: 8px 24px;
      border-radius: 20px;
      display: inline-block;
    }
    .section {
      page-break-inside: avoid;
      margin: 30px 0;
    }
    .section-title {
      color: #0C1225;
      border-left: 4px solid #E8A838;
      padding-left: 16px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Oracle Lumira</h1>
    <p>Lecture Spirituelle pour {{userName}}</p>
    <div class="archetype-badge">{{archetype}}</div>
  </div>

  <section class="introduction">
    <h2>Introduction</h2>
    <p>{{introduction}}</p>
  </section>

  {{#each sections}}
  <section class="section">
    <h2 class="section-title">
      {{domainIcon domain}} {{title}}
    </h2>
    <div class="content">{{{content}}}</div>
  </section>
  {{/each}}

  <section class="karmic">
    <h2>🔮 Insights Karmiques</h2>
    <ul>
      {{#each karmicInsights}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
  </section>

  <footer>
    <p>Généré le {{formatDate generatedAt}}</p>
  </footer>
</body>
</html>
```

---

## Gotenberg Docker Setup

```yaml
# docker/docker-compose.yml
services:
  gotenberg:
    image: gotenberg/gotenberg:8
    restart: always
    ports:
      - "3002:3000"
    environment:
      - CHROMIUM_DISABLE_JAVASCRIPT=true
    networks:
      - lumira-network
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Use page-break-inside: avoid | Let sections split across pages |
| Inline critical CSS | Link external stylesheets |
| Use web-safe fonts or embed | Rely on system fonts |
| Test with actual content length | Test only with short content |
| Handle Gotenberg timeouts | Assume conversion always succeeds |
| Cache compiled templates | Recompile on every request |
