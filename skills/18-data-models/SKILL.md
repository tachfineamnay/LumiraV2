---
name: Data Models & Schema
description: Complete Prisma schema reference with all models, relations, and business logic.
---

# Data Models & Schema

## Context

The database schema defines the core domain models for Oracle Lumira. Located at `packages/database/prisma/schema.prisma`.

---

## Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                      CORE ENTITIES                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐            │
│  │  User   │────────▶│UserProfile────────│         │            │
│  │         │    1:1  │         │         │         │            │
│  └────┬────┘         └─────────┘         └─────────┘            │
│       │                                                          │
│       │ 1:N                                                      │
│       ▼                                                          │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐            │
│  │  Order  │────────▶│OrderFile│         │ Expert  │            │
│  │         │    1:N  │         │         │         │            │
│  └────┬────┘         └─────────┘         └─────────┘            │
│       │                                                          │
│       │ 1:N                                                      │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────┐            │
│  │              SPIRITUAL JOURNEY                   │            │
│  │  ┌───────────────┐  ┌─────────┐  ┌───────────┐  │            │
│  │  │SpiritualPath  │─▶│PathStep │  │ Insight   │  │            │
│  │  └───────────────┘  └─────────┘  └───────────┘  │            │
│  │  ┌───────────────┐  ┌───────────────┐           │            │
│  │  │AkashicRecord  │  │ ChatSession   │           │            │
│  │  └───────────────┘  └───────────────┘           │            │
│  └─────────────────────────────────────────────────┘            │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## User Models

### User

The central user entity with CRM extensions.

```prisma
model User {
  id                 String             @id @default(cuid())
  refId              String?            @unique  // Business ID: LUM-C-YY-XXXX
  email              String             @unique
  firstName          String
  lastName           String
  phone              String?
  dateOfBirth        DateTime?
  stripeCustomerId   String?            @unique
  subscriptionStatus SubscriptionStatus @default(INACTIVE)
  status             UserStatus         @default(ACTIVE)
  
  // CRM fields
  totalOrders        Int                @default(0)
  lastOrderAt        DateTime?
  notes              String?            @db.Text  // Internal notes
  tags               String[]                      // CRM tags
  source             String?                       // Acquisition source
  
  createdAt          DateTime           @default(now())
  updatedAt          DateTime           @updatedAt

  // Relations
  profile       UserProfile?
  orders        Order[]
  spiritualPath SpiritualPath?
  chatSessions  ChatSession[]
  akashicRecord AkashicRecord?
}

enum UserStatus {
  ACTIVE
  BANNED
  SUSPENDED
}
```

### UserProfile

Extended profile data collected during onboarding.

```prisma
model UserProfile {
  id               String    @id @default(cuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id])
  
  // Birth data
  birthDate        String?
  birthTime        String?
  birthPlace       String?
  
  // Spiritual context
  specificQuestion String?   @db.Text
  objective        String?   @db.Text
  
  // Photos
  facePhotoUrl     String?
  palmPhotoUrl     String?
  
  // Life context
  highs            String?   @db.Text
  lows             String?   @db.Text
  strongSide       String?
  weakSide         String?
  strongZone       String?
  weakZone         String?
  
  // Preferences
  deliveryStyle    String?
  pace             Int?
  
  // Additional
  ailments         String?   @db.Text
  fears            String?   @db.Text
  rituals          String?   @db.Text
  
  profileCompleted Boolean   @default(false)
  submittedAt      DateTime?
}
```

---

## Order Models

### Order

Main purchase record linking user to reading.

```prisma
model Order {
  id                 String         @id @default(cuid())
  orderNumber        String         @unique  // LU250127-001
  userId             String
  user               User           @relation(...)
  userEmail          String
  userName           String?
  
  // Product
  level              Int            // 1-4 (Initié to Intégral)
  amount             Int            // Amount in cents
  currency           String         @default("eur")
  
  // Status
  status             OrderStatus    @default(PENDING)
  paidAt             DateTime?
  deliveredAt        DateTime?
  deliveryMethod     DeliveryFormat?
  
  // Stripe
  paymentIntentId    String?
  stripeSessionId    String?
  
  // Content
  formData           Json           // Onboarding answers
  clientInputs       Json?          // Additional inputs
  generatedContent   Json?          // AI response + PDF URL
  
  // Expert workflow
  expertPrompt       String?        @db.Text
  expertInstructions String?        @db.Text
  expertReview       Json?
  expertValidation   Json?
  revisionCount      Int            @default(0)
  
  // Error tracking
  errorLog           String?        @db.Text
}

enum OrderStatus {
  PENDING
  PAID
  PROCESSING
  AWAITING_VALIDATION
  COMPLETED
  FAILED
  REFUNDED
}

enum DeliveryFormat {
  EMAIL
  WHATSAPP
}
```

### OrderFile

Files attached to orders (photos, documents).

```prisma
model OrderFile {
  id          String   @id @default(cuid())
  orderId     String
  order       Order    @relation(...)
  name        String
  url         String
  key         String   // S3 key
  contentType String
  size        Int
  type        FileType
  uploadedAt  DateTime @default(now())
}

enum FileType {
  FACE_PHOTO
  PALM_PHOTO
}
```

---

## Spiritual Journey Models

### SpiritualPath

User's personalized spiritual journey.

```prisma
model SpiritualPath {
  id          String    @id @default(cuid())
  userId      String    @unique
  user        User      @relation(...)
  
  archetype   String    // "Le Guérisseur", "Le Visionnaire", etc.
  synthesis   String    @db.Text  // AI summary
  keyBlockage String?   // Main blockage identified
  
  startedAt   DateTime  @default(now())
  completedAt DateTime?
  
  steps       PathStep[]
}
```

### PathStep

Individual day in the 7-day spiritual path.

```prisma
model PathStep {
  id              String         @id @default(cuid())
  spiritualPathId String
  spiritualPath   SpiritualPath  @relation(...)
  
  dayNumber       Int            // 1-7
  title           String         // "L'Éveil de..."
  description     String         @db.Text
  synthesis       String         @db.Text  // AI content
  archetype       String         // Theme
  actionType      PathActionType @default(REFLECTION)
  ritualPrompt    String?        @db.Text
  
  isCompleted     Boolean        @default(false)
  completedAt     DateTime?
  unlockedAt      DateTime?      // When available
  
  // Origin tracking
  originReadingId String?
  originReading   Order?         @relation(...)

  @@unique([spiritualPathId, dayNumber])
}

enum PathActionType {
  MANTRA
  RITUAL
  JOURNALING
  MEDITATION
  REFLECTION
}
```

### Insight

AI-extracted insights by domain.

```prisma
model Insight {
  id          String          @id @default(cuid())
  userId      String
  orderId     String?
  category    InsightCategory
  short       String          @db.Text  // 2-3 sentences
  full        String          @db.Text  // 1-2 paragraphs
  viewedAt    DateTime?       // Null = "New" badge
  
  @@unique([userId, category])  // One per category per user
}

enum InsightCategory {
  SPIRITUEL
  RELATIONS
  MISSION
  CREATIVITE
  EMOTIONS
  TRAVAIL
  SANTE
  FINANCE
}
```

### AkashicRecord

Persistent spiritual memory for chat context.

```prisma
model AkashicRecord {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(...)
  
  archetype String?  // Primary archetype
  domains   Json     @default("{}")  // Per-domain summaries
  history   Json     @default("[]")  // Conversation history
}
```

### ChatSession

Chat conversations with Oracle Lumira.

```prisma
model ChatSession {
  id             String    @id @default(cuid())
  userId         String
  user           User      @relation(...)
  relatedOrderId String?   // Link to specific reading
  relatedOrder   Order?    @relation(...)
  
  title          String?   // Auto-generated
  messages       Json      @default("[]")  // [{role, content, timestamp}]
  isActive       Boolean   @default(true)
  lastMessageAt  DateTime?
}
```

---

## System Models

### Expert

Admin/expert user for back-office.

```prisma
model Expert {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String     // bcrypt hashed
  name      String
  role      ExpertRole @default(EXPERT)
  isActive  Boolean    @default(true)
  lastLogin DateTime?
}

enum ExpertRole {
  EXPERT
  ADMIN
}
```

### Product

Purchasable product catalog.

```prisma
model Product {
  id           String       @id  // 'initie', 'mystique', etc.
  name         String
  description  String
  amountCents  Int          // 2900 = 29€
  currency     String       @default("eur")
  level        ProductLevel
  features     String[]
  limitedOffer String?
  isActive     Boolean      @default(true)
  comingSoon   Boolean      @default(false)
  metadata     Json?
}

enum ProductLevel {
  INITIE
  MYSTIQUE
  PROFOND
  INTEGRALE
}
```

### ProcessedEvent

Idempotency tracking for webhooks.

```prisma
model ProcessedEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique  // Stripe event ID
  eventType   String
  processedAt DateTime @default(now())
  data        Json?
}
```

### SequenceCounter

Business ID generation.

```prisma
model SequenceCounter {
  id        String   @id @default(cuid())
  name      String   @unique  // "client_2026", "order_20260127"
  value     Int      @default(0)
}
```

---

## Index Strategy

Key indexes for performance:

```prisma
// User lookups
@@index([email])
@@index([refId])
@@index([status])

// Order queries
@@index([userId])
@@index([status])
@@index([level])
@@index([createdAt(sort: Desc)])

// Chat/Path queries
@@index([userId])
@@index([isCompleted])
@@index([lastMessageAt(sort: Desc)])
```

---

## Migration Commands

```bash
# After schema changes
pnpm db:generate   # Update Prisma client types
pnpm db:push       # Apply to database (dev)
pnpm db:migrate    # Create migration (prod)
pnpm db:studio     # Open Prisma Studio GUI
```
