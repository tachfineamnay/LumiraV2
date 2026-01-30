---
name: Admin Desk (Expert Portal)
description: Expert/Admin portal for order management, content review, and system administration.
---

# Admin Desk (Expert Portal)

## Context

The **Admin Desk** is the back-office interface for experts and administrators to:
- Review and approve AI-generated content
- Manage orders and customer data
- Configure system settings
- Monitor platform health

**Access**: `desk.oraclelumira.com` (subdomain routing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUBDOMAIN ROUTING                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  oraclelumira.com      → apps/web/app/ (Sanctuaire)            │
│  desk.oraclelumira.com → apps/web/app/admin/ (Desk)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Middleware**: `apps/web/middleware.ts`

```typescript
if (hostname.includes('desk.oraclelumira.com')) {
  // Rewrite to /admin routes
  const newUrl = new URL(`/admin${pathname}`, request.url);
  return NextResponse.rewrite(newUrl);
}
```

---

## Directory Structure

```
apps/web/app/admin/
├── page.tsx              # Dashboard redirect
├── layout.tsx            # Admin layout with sidebar
├── login/                # Expert authentication
├── settings/             # System configuration
└── (desk-v2)/           # Main desk interface
    ├── layout.tsx
    ├── orders/           # Order management
    ├── clients/          # CRM
    ├── products/         # Product catalog
    └── analytics/        # Metrics & insights
```

---

## Authentication

### Expert Token

```typescript
// Login stores expert_token
localStorage.setItem('expert_token', response.token);

// API client prioritizes expert_token
const expertToken = localStorage.getItem('expert_token');
const lumiraToken = localStorage.getItem('lumira_token');
const token = expertToken || lumiraToken;
```

### Expert Context

```tsx
// apps/web/context/ExpertAuthContext.tsx
import { useExpertAuth } from '@/context/ExpertAuthContext';

function AdminComponent() {
  const { expert, isAdmin, logout } = useExpertAuth();
  
  if (!expert) {
    return <LoginRedirect />;
  }
  
  if (!isAdmin && needsAdminAccess) {
    return <AccessDenied />;
  }
}
```

---

## Expert Roles

```prisma
enum ExpertRole {
  EXPERT    // Can review/edit content
  ADMIN     // Full system access
}

model Expert {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String     // bcrypt hashed
  name      String
  role      ExpertRole @default(EXPERT)
  isActive  Boolean    @default(true)
  lastLogin DateTime?
}
```

---

## Order Review Workflow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│PROCESSING│───▶│ AWAITING │───▶│ APPROVED │───▶│COMPLETED │
│(AI Gen)  │    │VALIDATION│    │(Expert)  │    │(Delivered│
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                     │                               
                     ▼                               
               ┌──────────┐                          
               │ REVISION │ (Needs changes)          
               │ NEEDED   │                          
               └──────────┘                          
```

### Review Actions

```typescript
// Expert reviews order
PUT /api/expert/orders/:id/review
{
  "action": "approve" | "request_revision" | "reject",
  "feedback": "Expert notes...",
  "expertInstructions": "AI refinement prompt..."
}

// If revision needed, triggers EDITOR agent
POST /api/expert/orders/:id/regenerate
{
  "instructions": "Make the tone more gentle..."
}
```

---

## Key Admin Endpoints

```typescript
// Expert auth
POST /api/expert/auth/login        // Expert login
GET  /api/expert/auth/me           // Current expert

// Order management
GET  /api/expert/orders            // List all orders
GET  /api/expert/orders/:id        // Order details
PUT  /api/expert/orders/:id        // Update order
PUT  /api/expert/orders/:id/review // Submit review
POST /api/expert/orders/:id/regenerate // Trigger AI refinement

// Client management
GET  /api/expert/clients           // List all users
GET  /api/expert/clients/:id       // User details
PUT  /api/expert/clients/:id/notes // Add CRM notes
PUT  /api/expert/clients/:id/tags  // Add tags

// Products
GET  /api/products                 // List products
PUT  /api/products/:id             // Update product

// System
GET  /api/expert/analytics         // Dashboard metrics
GET  /api/expert/settings          // System settings
PUT  /api/expert/settings/:key     // Update setting
```

---

## UI Components

```
apps/web/components/desk-v2/
├── OrdersTable.tsx        # Orders list with filters
├── OrderDetail.tsx        # Full order view
├── ContentEditor.tsx      # Edit AI content
├── ReviewPanel.tsx        # Approve/reject controls
├── ClientCard.tsx         # CRM user card
├── AnalyticsDashboard.tsx # Metrics overview
└── Sidebar.tsx            # Navigation
```

---

## Content Review Interface

The expert can view and edit AI-generated content:

```tsx
interface OrderReview {
  orderId: string;
  
  // AI-generated content
  generatedContent: {
    pdf_content: PdfContent;
    synthesis: ReadingSynthesis;
    timeline: TimelineDay[];
  };
  
  // Expert edits
  expertReview: {
    status: 'pending' | 'approved' | 'revision_needed' | 'rejected';
    feedback: string;
    editedContent?: Partial<PdfContent>;  // Expert overrides
    reviewedAt: Date;
    reviewedBy: string;
  };
}
```

---

## CRM Features

### User Model Extensions

```prisma
model User {
  // CRM fields
  refId       String?   @unique  // Business ID: LUM-C-YY-XXXX
  totalOrders Int       @default(0)
  lastOrderAt DateTime?
  notes       String?   @db.Text // Internal CRM notes
  tags        String[]           // CRM tags
  source      String?            // Acquisition source
  status      UserStatus @default(ACTIVE)
}

enum UserStatus {
  ACTIVE
  BANNED
  SUSPENDED
}
```

### Client List Filters

```typescript
// GET /api/expert/clients?status=ACTIVE&tag=vip&search=marie
interface ClientFilters {
  status?: UserStatus;
  tag?: string;
  search?: string;      // Email or name
  minOrders?: number;
  dateRange?: { from: Date; to: Date };
}
```

---

## System Settings

```prisma
model SystemSetting {
  id          String   @id
  key         String   @unique
  value       String   @db.Text
  isEncrypted Boolean  @default(false)
}
```

### Settings Keys

```typescript
const SETTINGS_KEYS = {
  // AI Configuration
  'ai.model': 'gemini-2.0-flash',
  'ai.temperature': '0.7',
  
  // Notifications
  'notifications.email_enabled': 'true',
  'notifications.whatsapp_enabled': 'false',
  
  // Business
  'business.default_currency': 'eur',
  'business.vat_rate': '20',
};
```

---

## Access Control

```typescript
// Middleware for admin routes
@UseGuards(JwtAuthGuard, ExpertRolesGuard)
@Roles(ExpertRole.ADMIN)
@Controller('expert/settings')
export class SettingsController {
  // Only ADMIN can access
}

// Expert role check
@Roles(ExpertRole.EXPERT, ExpertRole.ADMIN)
@Controller('expert/orders')
export class OrdersController {
  // Both EXPERT and ADMIN can access
}
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Validate expert token on every request | Trust client-side role checks |
| Log all admin actions (audit trail) | Allow silent data modifications |
| Require reason for rejections | Reject orders without feedback |
| Use optimistic updates in UI | Wait for full page reloads |
| Paginate large order lists | Load all orders at once |
| Cache expert permissions | Query DB on every action |
