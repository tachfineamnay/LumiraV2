---
name: Backend Architecture (NestJS)
description: NestJS 10 modular architecture, services, DTOs, guards, and API patterns.
---

# Backend Architecture (NestJS)

## Context

- **Framework**: NestJS 10
- **Location**: `apps/api/`
- **Port**: 3001 (dev), 3001 (prod via Coolify)
- **Architecture**: Modular monolith with strict separation

---

## Directory Structure

```
apps/api/src/
├── modules/
│   ├── auth/           # Authentication & guards
│   ├── users/          # User management
│   ├── missions/       # Mission CRUD
│   ├── wall/           # Feed/Wall feature
│   └── insights/       # AI insights
├── services/
│   └── factory/        # Business logic factories
│       ├── DigitalSoulService.ts    # Orchestrator (AI→PDF→S3→DB→Audio)
│       ├── VertexOracle.ts          # Multi-agent AI (SCRIBE/GUIDE/EDITOR/CONFIDANT)
│       ├── AudioGenerationService.ts # TTS pipeline (text→SSML→TTS→S3)
│       ├── AudioScriptService.ts    # LLM NARRATOR reformulation
│       ├── PdfFactory.ts            # PDF generation (Handlebars+Gotenberg)
│       └── ContextDispatcher.ts     # Context-aware orchestration
├── common/
│   ├── decorators/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
└── main.ts
```

---

## Core Principles

1. **Dependency Injection**: All services are injectable. No global state.
2. **Factory Pattern**: Complex object creation via Factories (e.g., `PdfFactory`).
3. **Saga Pattern**: Long processes orchestrated in dedicated services.
4. **DTOs Everywhere**: Validate all inputs with `class-validator`.

---

## Module Structure

```typescript
// missions/missions.module.ts
@Module({
  imports: [DatabaseModule],
  controllers: [MissionsController],
  providers: [MissionsService],
  exports: [MissionsService],
})
export class MissionsModule {}
```

---

## Service Pattern

```typescript
@Injectable()
export class MissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: MissionFiltersDto): Promise<Mission[]> {
    return this.prisma.mission.findMany({
      where: this.buildWhereClause(filters),
      include: { user: true },
    });
  }
}
```

---

## DTO Validation

```typescript
// dto/create-mission.dto.ts
export class CreateMissionDto {
  @IsString()
  @MinLength(10)
  title: string;

  @IsEnum(MissionType)
  type: MissionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;
}
```

---

## Guards

### JWT Authentication

```typescript
@UseGuards(JwtAuthGuard)
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return user;
}
```

### Role-Based Access

```typescript
@Roles(Role.ADMIN, Role.EXPERT)
@UseGuards(JwtAuthGuard, RolesGuard)
@Get('admin/users')
getAllUsers() { ... }
```

---

## Key Services

### DigitalSoulService

Orchestrates AI generation workflow:

```typescript
@Injectable()
export class DigitalSoulService {
  async processOrder(orderId: string): Promise<void> {
    // 1. Fetch order
    // 2. Call VertexOracle for AI analysis
    // 3. Generate PDF via PdfFactory
    // 4. Store results in DB (transaction)
    // 5. Notify user
    // 6. Fire-and-forget audio generation via AudioGenerationService
  }
}
```

### AudioGenerationService

TTS pipeline — converts text to spoken audio:

```typescript
@Injectable()
export class AudioGenerationService {
  async generateAllAudio(orderId: string): Promise<void> {
    // 1. Fetch insights + synthesis for order
    // 2. Reformulate text via AudioScriptService (NARRATOR)
    // 3. Convert to SSML
    // 4. Synthesize via Google Cloud TTS
    // 5. Upload MP3 to S3
    // 6. Save URLs to DB (Insight.audioUrl + OrderFile AUDIO_READING)
  }
}
```

See skill `25-audio-pipeline` for full details.
```

### VertexOracle

Encapsulates Vertex AI communication:

```typescript
@Injectable()
export class VertexOracle {
  async generateReading(input: ReadingInput): Promise<ReadingOutput> {
    // Prompt engineering + API call + JSON parsing
  }
}
```

---

## Error Handling

```typescript
// Use standard NestJS exceptions
throw new NotFoundException(`Mission ${id} not found`);
throw new BadRequestException('Invalid date range');
throw new ForbiddenException('Access denied');

// Global exception filter handles formatting
```

---

## Logging

```typescript
import { Logger } from '@nestjs/common';

@Injectable()
export class MissionsService {
  private readonly logger = new Logger(MissionsService.name);

  async create(dto: CreateMissionDto) {
    this.logger.log(`Creating mission: ${dto.title}`);
    // Never use console.log
  }
}
```
