---
name: Stripe Payment Integration
description: Complete Stripe integration for checkout, webhooks, and subscription management.
---

# Stripe Payment Integration

## Context

Oracle Lumira uses **Stripe** for payment processing:
- **Checkout Sessions** for one-time purchases (readings)
- **Webhooks** for async payment confirmation
- **Customer Portal** for subscription management (future)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    PAYMENT FLOW                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ Frontend │───▶│   API    │───▶│  Stripe  │───▶│ Webhook  │  │
│  │ Checkout │    │ Create   │    │ Checkout │    │ Handler  │  │
│  │   Form   │    │ Session  │    │  Page    │    │          │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                               │          │
│       │         ┌────────────────────────────────────┘          │
│       │         │                                               │
│       │         ▼                                               │
│       │    ┌──────────┐    ┌──────────┐    ┌──────────┐        │
│       └───▶│ Success  │───▶│ Generate │───▶│ Deliver  │        │
│            │  Page    │    │ Content  │    │  Email   │        │
│            └──────────┘    └──────────┘    └──────────┘        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Frontend Setup

### Stripe Provider

```tsx
// apps/web/context/StripeProvider.tsx
'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

export function StripeProvider({ children }: { children: React.ReactNode }) {
  const options = {
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#E8A838',  // horizon-400
        colorBackground: '#0C1225', // abyss-700
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      {children}
    </Elements>
  );
}
```

### Checkout Component

```tsx
// apps/web/components/checkout/CheckoutForm.tsx
'use client';

import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

export function CheckoutForm({ productId, formData }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Create checkout session via API
    const { data } = await api.post('/payments/create-session', {
      productId,
      formData,
      successUrl: `${window.location.origin}/payment-success`,
      cancelUrl: `${window.location.origin}/checkout?cancelled=true`,
    });

    // 2. Redirect to Stripe Checkout
    window.location.href = data.url;
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      <button type="submit" disabled={!stripe}>
        Payer maintenant
      </button>
    </form>
  );
}
```

---

## Backend Implementation

### Payments Module

```
apps/api/src/modules/payments/
├── payments.module.ts
├── payments.controller.ts
├── payments.service.ts
└── dto/
    ├── create-session.dto.ts
    └── webhook.dto.ts
```

### Create Checkout Session

```typescript
// payments.service.ts
import Stripe from 'stripe';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    this.stripe = new Stripe(
      this.configService.get('STRIPE_SECRET_KEY'),
      { apiVersion: '2024-04-10' }
    );
  }

  async createCheckoutSession(dto: CreateSessionDto) {
    const product = await this.getProduct(dto.productId);

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: product.amountCents,
        },
        quantity: 1,
      }],
      success_url: dto.successUrl + '?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: dto.cancelUrl,
      metadata: {
        productId: dto.productId,
        formData: JSON.stringify(dto.formData),
      },
      customer_email: dto.formData.email,
    });

    return { sessionId: session.id, url: session.url };
  }
}
```

---

## Webhook Handling

### Webhook Controller

```typescript
// apps/api/src/modules/webhooks/webhooks.controller.ts
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private paymentsService: PaymentsService,
    private ordersService: OrdersService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const event = this.paymentsService.constructEvent(
      req.rawBody,
      signature,
    );

    // Idempotency check
    const exists = await this.processedEventExists(event.id);
    if (exists) {
      return { received: true, duplicate: true };
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;
    }

    // Mark event as processed
    await this.markEventProcessed(event);
    
    return { received: true };
  }
}
```

### Checkout Complete Handler

```typescript
async handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const { productId, formData } = session.metadata;
  const parsedFormData = JSON.parse(formData);

  // 1. Create order
  const order = await this.ordersService.create({
    email: session.customer_email,
    ...parsedFormData,
    totalAmount: session.amount_total,
    stripeSessionId: session.id,
    paymentIntentId: session.payment_intent as string,
  });

  // 2. Update order status to PAID
  await this.ordersService.update(order.id, {
    status: 'PAID',
    paidAt: new Date(),
  });

  // 3. Trigger AI generation (async)
  this.generateContent(order.id); // Fire and forget
}
```

---

## Idempotency

Prevent duplicate processing with `ProcessedEvent` model:

```prisma
model ProcessedEvent {
  id          String   @id @default(cuid())
  eventId     String   @unique  // Stripe event ID
  eventType   String
  processedAt DateTime @default(now())
  data        Json?
}
```

```typescript
async processedEventExists(eventId: string): Promise<boolean> {
  const event = await this.prisma.processedEvent.findUnique({
    where: { eventId },
  });
  return !!event;
}
```

---

## Environment Variables

```bash
# Frontend (.env.local)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx

# Backend (.env)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

---

## Webhook Testing

### Local Development

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:3001/api/webhooks/stripe

# In another terminal, trigger test events
stripe trigger checkout.session.completed
```

### Production Webhook URL

```
https://api.oraclelumira.com/api/webhooks/stripe
```

---

## Product Catalog

Products stored in database:

```prisma
model Product {
  id           String       @id  // 'initie', 'mystique', etc.
  name         String
  description  String
  amountCents  Int          // Price in cents (2900 = 29€)
  currency     String       @default("eur")
  level        ProductLevel
  features     String[]
  isActive     Boolean      @default(true)
  comingSoon   Boolean      @default(false)
}

enum ProductLevel {
  INITIE
  MYSTIQUE
  PROFOND
  INTEGRALE
}
```

---

## Error Handling

```typescript
// Payment failed webhook
async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  const order = await this.prisma.order.findFirst({
    where: { paymentIntentId: paymentIntent.id },
  });

  if (order) {
    await this.ordersService.update(order.id, {
      status: 'FAILED',
      errorLog: paymentIntent.last_payment_error?.message,
    });

    // Notify customer
    await this.notificationsService.sendPaymentFailed(order);
  }
}
```

---

## Best Practices

| ✅ DO | ❌ DON'T |
|-------|----------|
| Verify webhook signatures | Trust unverified webhooks |
| Use idempotency keys | Process same event twice |
| Store Stripe IDs in DB | Rely on session data alone |
| Handle all webhook event types | Ignore failure events |
| Test with Stripe CLI locally | Deploy untested webhooks |
| Use metadata for context | Pass data via URL params |
