---
name: AI Integration
description: Google Gemini API configuration, VertexOracle service, and prompt engineering patterns.
---

# AI Integration

## Context

Lumira V2 integrates AI capabilities via **Google Gemini API** (not Vertex AI directly):

| Service | Purpose |
|---------|---------|
| **VertexOracle** | Multi-agent AI for readings |
| **Gemini API** | Primary AI provider (gemini-2.0-flash) |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  NestJS API     │────▶│  VertexOracle    │────▶│  Gemini AI  │
│  (Controller)   │     │  (4 Agents)      │     │  (Google)   │
└─────────────────┘     └──────────────────┘     └─────────────┘
         │
         ▼
┌─────────────────┐
│  PdfFactory     │ (Handlebars + Gotenberg)
└─────────────────┘
```

---

## VertexOracle Service

### Location: `apps/api/src/services/factory/VertexOracle.ts`

Four specialized agents share a common personality (LUMIRA_DNA):

```typescript
@Injectable()
export class VertexOracle {
  private model: GenerativeModel;

  constructor(private configService: ConfigService) {
    const genAI = new GoogleGenerativeAI(
      this.configService.get('GEMINI_API_KEY')
    );
    this.model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash' 
    });
  }
}
```

### Agent Types

| Agent | Role | Output |
|-------|------|--------|
| **SCRIBE** | Generates PDF reading | `PdfContent` + `ReadingSynthesis` |
| **GUIDE** | Creates 7-day timeline | `TimelineDay[]` |
| **EDITOR** | Refines per expert feedback | Updated content |
| **CONFIDANT** | Real-time chat | Chat response |

---

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your-gemini-api-key

# Optional overrides (in VertexOracle)
# Model defaults to gemini-2.0-flash
# Temperature defaults to 0.7
```

---

## Prompt Engineering Guidelines

### Structure

1. **Role Definition**: Define the AI's persona (LUMIRA_DNA)
2. **Context**: Provide all user data
3. **Output Format**: Specify JSON schema explicitly
4. **Constraints**: List rules and requirements

### LUMIRA_DNA (Shared Personality)

```typescript
const LUMIRA_DNA = `
Tu es Oracle Lumira, une intelligence spirituelle ancestrale.
Tu combines la sagesse de l'astrologie, de la numérologie, de la physiognomonie 
et de la chiromancie pour offrir des guidances profondément personnalisées.

PERSONNALITÉ:
- Bienveillant mais direct - tu nommes les choses avec douceur
- Mystique mais accessible - tu parles avec poésie sans être obscur
- Empathique mais responsabilisant - tu guides sans créer de dépendance
- Français élégant, tutoiement chaleureux

ARCHÉTYPES LUMIRA:
- Le Guérisseur: Empathie profonde, soigne par la présence et l'écoute
- Le Visionnaire: Voit au-delà des apparences, connecté aux possibles
- Le Guide: Éclaire le chemin des autres, mentor naturel
- Le Créateur: Transforme et manifeste, alchimiste de la matière
- Le Sage: Sagesse tranquille, équilibre incarné entre les mondes
`;
```

### Agent-Specific Context Example (SCRIBE)

```typescript
const AGENT_CONTEXTS = {
  SCRIBE: `
MISSION SCRIBE:
Tu génères la lecture spirituelle principale au format PDF.

FORMAT DE SORTIE (JSON strict):
{
  "pdf_content": {
    "introduction": "Introduction personnalisée (150+ mots)...",
    "archetype_reveal": "Révélation de l'archétype dominant...",
    "sections": [
      {"domain": "spirituel", "title": "...", "content": "200+ mots..."},
      // 8 domains total
    ],
    "karmic_insights": ["Insight 1", "Insight 2", "Insight 3"],
    "life_mission": "Description (100+ mots)...",
    "rituals": [{"name": "...", "description": "...", "instructions": [...]}],
    "conclusion": "Message de clôture..."
  },
  "synthesis": {
    "archetype": "Le Guérisseur" | "Le Visionnaire" | etc.,
    "keywords": ["mot1", "mot2", "mot3", "mot4", "mot5"],
    "emotional_state": "État émotionnel détecté...",
    "key_blockage": "Blocage principal..."
  }
}

RÈGLES:
- Chaque section DOIT faire minimum 200 mots
- Personnalise TOUT en fonction des données fournies
- Écris en français élégant et poétique
  `,
};
```

---

## Response Parsing with Zod

Always validate AI responses:

```typescript
import { z } from 'zod';

const SynthesisSchema = z.object({
  archetype: z.enum([
    'Le Guérisseur', 'Le Visionnaire', 'Le Guide', 
    'Le Créateur', 'Le Sage'
  ]),
  keywords: z.array(z.string()).length(5),
  emotional_state: z.string(),
  key_blockage: z.string(),
});

const PdfContentSchema = z.object({
  introduction: z.string().min(100),
  archetype_reveal: z.string(),
  sections: z.array(z.object({
    domain: z.string(),
    title: z.string(),
    content: z.string().min(100),
  })).length(8),
  karmic_insights: z.array(z.string()).length(3),
  life_mission: z.string().min(50),
  rituals: z.array(z.object({
    name: z.string(),
    description: z.string(),
    instructions: z.array(z.string()),
  })),
  conclusion: z.string(),
});

async parseResponse(raw: string): Promise<OracleResponse> {
  try {
    const json = JSON.parse(raw);
    return OracleResponseSchema.parse(json);
  } catch (e) {
    this.logger.error('AI response parsing failed', e);
    throw new InternalServerErrorException('AI response invalid');
  }
}
```

---

## Image Analysis

For physiognomy (face) and chiromancy (palm):

```typescript
async analyzePhoto(imageUrl: string, type: 'face' | 'palm'): Promise<string> {
  const imageData = await this.fetchImageAsBase64(imageUrl);
  
  const prompt = type === 'face' 
    ? 'Analyse les traits du visage pour une lecture physiognomonique...'
    : 'Analyse les lignes de la main pour une lecture chiromantique...';

  const result = await this.model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: 'image/jpeg', data: imageData } }
  ]);

  return result.response.text();
}
```

---

## Error Handling

```typescript
async generateWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      this.logger.warn(`AI attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        throw new ServiceUnavailableException('AI service unavailable');
      }
      
      // Exponential backoff
      await this.sleep(1000 * Math.pow(2, attempt));
    }
  }
}
```

---

## Rate Limiting

The API module has ThrottlerModule configured:

```typescript
// apps/api/src/app.module.ts
ThrottlerModule.forRoot([{
  ttl: 60000,  // 60 seconds
  limit: 100,  // 100 requests
}]),
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Validate all AI outputs with Zod | Trust raw JSON responses |
| Include complete user context | Send partial data |
| Use LUMIRA_DNA for consistency | Create different personas |
| Set temperature to 0.7 for creativity | Use 0 (too rigid) or 1 (too random) |
| Log all AI calls with context | Swallow errors silently |
| Handle rate limits with backoff | Retry immediately on failure |
| Specify JSON output format | Expect freeform text |
