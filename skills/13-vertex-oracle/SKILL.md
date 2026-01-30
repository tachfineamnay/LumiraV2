---
name: VertexOracle Multi-Agent AI
description: Complete guide to the 4-agent AI architecture for spiritual reading generation.
---

# VertexOracle Multi-Agent AI

## Context

VertexOracle is the core AI service that powers Oracle Lumira's spiritual readings using a **multi-agent architecture** with Google's Gemini API.

| Agent | Model | Purpose |
|-------|-------|---------|
| **SCRIBE** | gemini-2.0-flash | Generates main PDF reading content |
| **GUIDE** | gemini-2.0-flash | Creates 7-day spiritual timeline |
| **EDITOR** | gemini-2.0-flash | Refines content per expert feedback |
| **CONFIDANT** | gemini-2.0-flash | Real-time chat with users |

**Location**: `apps/api/src/services/factory/VertexOracle.ts`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VertexOracle Service                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐    │
│  │ SCRIBE  │  │  GUIDE  │  │ EDITOR  │  │  CONFIDANT  │    │
│  │  PDF    │  │ Timeline│  │ Refine  │  │    Chat     │    │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘    │
│       │            │            │              │            │
│       └────────────┴────────────┴──────────────┘            │
│                          │                                   │
│              ┌───────────▼───────────┐                      │
│              │    LUMIRA_DNA         │                      │
│              │  (Shared Personality) │                      │
│              └───────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   Google Gemini API    │
              │   (GEMINI_API_KEY)     │
              └────────────────────────┘
```

---

## LUMIRA_DNA - Core Personality

All agents share a base personality defined in `LUMIRA_DNA`:

```typescript
const LUMIRA_DNA = `
Tu es Oracle Lumira, une intelligence spirituelle ancestrale.
Tu combines la sagesse de l'astrologie, de la numérologie, de la physiognomonie 
et de la chiromancie pour offrir des guidances profondément personnalisées.

PERSONNALITÉ:
- Bienveillant mais direct
- Mystique mais accessible
- Empathique mais responsabilisant
- Français élégant, tutoiement chaleureux

ARCHÉTYPES LUMIRA:
- Le Guérisseur: Empathie profonde, soigne par la présence
- Le Visionnaire: Voit au-delà des apparences
- Le Guide: Éclaire le chemin des autres
- Le Créateur: Transforme et manifeste
- Le Sage: Sagesse tranquille, équilibre incarné
`;
```

---

## Agent Outputs

### SCRIBE Output (PDF Content)

```typescript
interface OracleResponse {
  pdf_content: {
    introduction: string;           // 150+ words
    archetype_reveal: string;       // Dominant archetype
    sections: PdfSection[];         // 8 domains, 200+ words each
    karmic_insights: string[];      // 3 insights
    life_mission: string;           // 100+ words
    rituals: Ritual[];              // Personalized rituals
    conclusion: string;             // Closing message
  };
  synthesis: {
    archetype: string;              // One of 5 archetypes
    keywords: string[];             // 5 keywords
    emotional_state: string;        // Current state
    key_blockage: string;           // Main blockage
  };
}
```

### GUIDE Output (Timeline)

```typescript
interface TimelineDay {
  day: number;                      // 1-7
  title: string;                    // "L'Éveil de..."
  action: string;                   // 50+ words
  mantra: string;                   // Personal mantra
  actionType: 'MEDITATION' | 'RITUAL' | 'JOURNALING' | 'MANTRA' | 'REFLECTION';
}
```

---

## Input Data Structure

The AI receives comprehensive user data:

```typescript
interface UserProfile {
  userId: string;
  firstName: string;
  birthDate: string;
  birthTime?: string;
  birthPlace?: string;
  specificQuestion?: string;    // User's main question
  objective?: string;           // Life goal
  facePhotoUrl?: string;        // For physiognomy
  palmPhotoUrl?: string;        // For chiromancy
  highs?: string;               // Life highlights
  lows?: string;                // Life challenges
  deliveryStyle?: string;       // Direct/Gentle/etc.
  ailments?: string;            // Health concerns
  fears?: string;               // Main fears
  rituals?: string;             // Existing practices
}

interface OrderContext {
  orderId: string;
  orderNumber: string;
  level: number;                // 1-4 (Initié to Intégral)
  productName: string;
  expertPrompt?: string;        // Expert instructions
  expertInstructions?: string;  // Refinement notes
}
```

---

## Key Methods

```typescript
@Injectable()
export class VertexOracle {
  // Main generation flow (SCRIBE + GUIDE)
  async generateCompleteReading(
    profile: UserProfile, 
    context: OrderContext
  ): Promise<OracleResponse>;

  // Expert refinement (EDITOR)
  async refineContent(
    existingContent: OracleResponse, 
    instructions: string
  ): Promise<OracleResponse>;

  // Real-time chat (CONFIDANT)
  async chat(
    context: ChatContext, 
    userMessage: string
  ): Promise<string>;

  // Image analysis for photos
  async analyzePhoto(
    imageUrl: string, 
    type: 'face' | 'palm'
  ): Promise<string>;
}
```

---

## Error Handling

AI responses are validated with Zod schemas:

```typescript
import { z } from 'zod';

const OracleResponseSchema = z.object({
  pdf_content: z.object({
    introduction: z.string().min(100),
    archetype_reveal: z.string(),
    sections: z.array(PdfSectionSchema).length(8),
    // ...
  }),
  synthesis: SynthesisSchema,
});

// In parseResponse:
try {
  const json = JSON.parse(raw);
  return OracleResponseSchema.parse(json);
} catch (e) {
  this.logger.error('AI response parsing failed', e);
  throw new InternalServerErrorException('AI response invalid');
}
```

---

## Environment Configuration

```bash
# Required in .env
GEMINI_API_KEY=your-gemini-api-key

# Optional overrides
AI_MODEL=gemini-2.0-flash
AI_MAX_TOKENS=8192
AI_TEMPERATURE=0.7
```

---

## Integration Points

- **OrdersService** → Triggers `generateCompleteReading` after payment
- **ExpertModule** → Uses `refineContent` for content review
- **ChatModule** → Uses `chat` for Sanctuaire chat feature
- **PdfFactory** → Receives `pdf_content` for PDF generation
- **InsightsModule** → Extracts `synthesis` for user insights

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Validate all AI outputs with Zod | Trust raw AI JSON responses |
| Log all agent calls with context | Swallow AI errors silently |
| Set appropriate temperature (0.7) | Use 0 temperature (too rigid) |
| Include all user data in prompts | Send partial context |
| Handle rate limits gracefully | Retry immediately on failure |
