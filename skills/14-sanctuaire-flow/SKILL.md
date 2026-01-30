---
name: Sanctuaire User Flow
description: Complete user journey from onboarding through checkout, reading delivery, and spiritual path.
---

# Sanctuaire User Flow

## Context

The **Sanctuaire** is the user-facing portal where clients:
1. Complete onboarding with personal data
2. Purchase spiritual readings (4 tiers)
3. Access their generated content
4. Follow their 7-day spiritual path
5. Chat with Oracle Lumira AI

**Location**: `apps/web/app/sanctuaire/`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SANCTUAIRE FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Landing  │───▶│ Onboard  │───▶│ Checkout │───▶│ Payment  │ │
│  │  Page    │    │  Wizard  │    │  (Stripe)│    │ Success  │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                        │        │
│                                                        ▼        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │   Chat   │◀───│ Insights │◀───│   Path   │◀───│ Sanctuaire│ │
│  │ Lumira   │    │  Cards   │    │ Timeline │    │  Portal  │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
apps/web/app/sanctuaire/
├── page.tsx                 # Main portal (post-login)
├── layout.tsx               # Sanctuaire layout with auth
├── SanctuaireLayoutClient.tsx
├── login/                   # Magic link login
├── profile/                 # User profile management
├── insights/                # AI-generated insights grid
├── path/                    # 7-day spiritual timeline
├── chat/                    # Chat with Oracle Lumira
├── draws/                   # Tarot/oracle draws
├── synthesis/               # Overall reading synthesis
└── settings/                # User preferences
```

---

## Product Tiers

| Level | ID | Price | Features |
|-------|-----|-------|----------|
| 1 | `initie` | 29€ | Basic reading + 3 insights |
| 2 | `mystique` | 59€ | + Timeline + Chat (limited) |
| 3 | `profond` | 99€ | + Full chat + Rituals |
| 4 | `integrale` | 149€ | + Akashic records + Priority |

Defined in: `packages/shared/src/constants/catalog.ts`

---

## Authentication Flow

### Token Storage

```typescript
// User tokens (Sanctuaire)
localStorage.getItem('sanctuaire_token')  // JWT
localStorage.getItem('lumira_token')      // Legacy alias

// Expert tokens (Admin Desk)
localStorage.getItem('expert_token')      // Admin JWT
```

### Contexts

```typescript
// apps/web/context/
├── SanctuaireAuthContext.tsx  // User auth state
├── SanctuaireContext.tsx      // Entitlements & capabilities
├── AuthContext.tsx            // Legacy/general auth
└── ExpertAuthContext.tsx      // Admin auth
```

### Checking Entitlements

```tsx
'use client';
import { useSanctuaire } from '@/context/SanctuaireContext';

function FeatureComponent() {
  const { 
    capabilities, 
    hasCapability, 
    highestLevel,
    levelMetadata 
  } = useSanctuaire();

  // Check specific capability
  if (!hasCapability('chat_unlimited')) {
    return <UpgradePrompt />;
  }

  // Check level
  if (highestLevel < 2) {
    return <LockedFeature minLevel={2} />;
  }

  return <Feature />;
}
```

---

## Onboarding Wizard

**Component**: `apps/web/components/onboarding/HolisticWizard.tsx`

Multi-step form collecting:

```typescript
interface OnboardingData {
  // Step 1: Identity
  firstName: string;
  lastName: string;
  email: string;
  
  // Step 2: Birth Data
  birthDate: string;
  birthTime?: string;
  birthPlace?: string;
  
  // Step 3: Life Context
  specificQuestion: string;    // Main spiritual question
  objective: string;           // Life goal
  highs: string;               // Life highlights
  lows: string;                // Life challenges
  
  // Step 4: Photos (optional)
  facePhoto?: File;            // Physiognomy analysis
  palmPhoto?: File;            // Chiromancy analysis
  
  // Step 5: Preferences
  deliveryStyle: 'direct' | 'gentle' | 'poetic';
  pace: number;                // Reading pace 1-5
  
  // Step 6: Deeper Context
  ailments?: string;
  fears?: string;
  rituals?: string;
}
```

---

## Checkout Flow

### 1. Stripe Provider

```tsx
// apps/web/context/StripeProvider.tsx
import { Elements } from '@stripe/react-stripe-js';

<Elements stripe={stripePromise} options={options}>
  <CheckoutForm />
</Elements>
```

### 2. Payment Intent Creation

```typescript
// API: POST /api/payments/create-session
const response = await api.post('/payments/create-session', {
  productId: 'mystique',
  formData: onboardingData,
});
// Returns: { sessionId, url }
```

### 3. Webhook Processing

```
Stripe Webhook (checkout.session.completed)
    │
    ▼
apps/api/src/modules/webhooks/webhooks.controller.ts
    │
    ├─▶ Create Order (status: PAID)
    ├─▶ Trigger VertexOracle.generateCompleteReading()
    ├─▶ Generate PDF via PdfFactory
    └─▶ Send notification email
```

---

## Post-Purchase Flow

### Order Status Flow

```
PENDING → PAID → PROCESSING → AWAITING_VALIDATION → COMPLETED
                     │               │
                     ▼               ▼
               AI Generation    Expert Review
```

### Content Delivery

1. **Insights** - Extracted from `synthesis` → `Insight` model
2. **Timeline** - Saved to `SpiritualPath` + `PathStep` models
3. **PDF** - Stored in S3, link in `Order.generatedContent`
4. **Akashic Record** - Updated with new session data

---

## Key API Endpoints

```typescript
// Sanctuaire routes
GET  /api/users/entitlements     // Check user capabilities
GET  /api/users/profile          // Get profile data
PUT  /api/users/profile          // Update profile

// Orders
GET  /api/orders                 // List user orders
GET  /api/orders/:id             // Order details + content

// Insights
GET  /api/insights               // User's insight cards
PUT  /api/insights/:id/view      // Mark as viewed

// Spiritual Path
GET  /api/path                   // Get 7-day timeline
PUT  /api/path/:stepId/complete  // Mark step done

// Chat
POST /api/chat                   // Send message to Lumira
GET  /api/chat/sessions          // List chat sessions
GET  /api/chat/sessions/:id      // Get session messages
```

---

## UI Components

### Key Sanctuaire Components

```
apps/web/components/sanctuary/
├── InsightsGrid.tsx       # 8-category insight cards
├── TimelineView.tsx       # 7-day path visualization
├── ChatInterface.tsx      # Chat with Lumira
└── SynthesisCard.tsx      # Overview archetype card

apps/web/components/onboarding/
├── HolisticWizard.tsx     # Multi-step form
├── SmartPhotoUploader.tsx # Face/palm photo upload
└── OracleOnboardingChat.tsx # Conversational onboarding
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Check entitlements before showing features | Hard-code level checks |
| Use `useSanctuaire()` for capability checks | Fetch entitlements on every component |
| Show upgrade prompts for locked features | Hide features silently |
| Persist form progress in localStorage | Lose data on page refresh |
| Use loading states during checkout | Let users click submit twice |
