/**
 * Migration Script — Lumira V2
 * ─────────────────────────────────────────────────────────────────────────────
 * Migrates existing paying users (Order.status === PAID | COMPLETED) who do
 * not yet have a Subscription record to the new 29€/month subscription model.
 *
 * For each eligible user the script:
 *   1. Creates (or reuses) a Stripe Customer.
 *   2. Creates a Stripe Subscription with a 30-day trial so legacy users are
 *      not billed immediately but are immediately "subscribed".
 *   3. Inserts a Subscription row in the database (status: ACTIVE).
 *
 * A 500 ms pause is applied between users to stay within Stripe's rate limits.
 * Each user is wrapped in its own try/catch so a single failure never aborts
 * the whole run.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *   # From the apps/api directory:
 *   npx tsx src/scripts/migrate-subscriptions.ts
 *
 *   # Or via ts-node with path aliases:
 *   npx ts-node -r tsconfig-paths/register src/scripts/migrate-subscriptions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env BEFORE importing anything that reads process.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import Stripe from 'stripe';
import { PrismaClient } from '@packages/database';

// ─────────────────────────────────────────────────────────────────────────────
// PRISMA (direct instantiation — avoids stale global-singleton type issues)
// NOTE: Run `pnpm db:generate` before executing this script.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient() as any;

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_29_MONTHLY = process.env.STRIPE_PRICE_29_MONTHLY;
const DELAY_BETWEEN_USERS_MS = 500;

if (!STRIPE_SECRET_KEY) {
    console.error('❌  STRIPE_SECRET_KEY is not set. Aborting.');
    process.exit(1);
}

if (!STRIPE_PRICE_29_MONTHLY) {
    console.error('❌  STRIPE_PRICE_29_MONTHLY is not set. Aborting.');
    process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-12-15.clover' as any });

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function migrate(): Promise<void> {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║   Lumira V2 — Legacy Subscription Migration              ║');
    console.log(`║   Started at: ${new Date().toISOString()}         ║`);
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ── Step 1: Identify eligible users ──────────────────────────────────────
    // Users who have at least one successful Order but no Subscription row yet.
    const eligibleUsers = await prisma.user.findMany({
        where: {
            subscription: null,         // no Subscription record
            orders: {
                some: {
                    status: { in: ['PAID', 'COMPLETED'] },
                },
            },
        },
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            stripeCustomerId: true,
        },
    });

    if (eligibleUsers.length === 0) {
        console.log('✅  No eligible users found. Nothing to migrate.');
        await prisma.$disconnect();
        return;
    }

    console.log(`📋  Found ${eligibleUsers.length} user(s) requiring migration.\n`);
    console.log('─'.repeat(60));

    let successCount = 0;
    let failCount = 0;

    // ── Step 2: Process each user ─────────────────────────────────────────────
    for (let i = 0; i < eligibleUsers.length; i++) {
        const user = eligibleUsers[i];
        const tag = `[${i + 1}/${eligibleUsers.length}] ${user.email}`;

        console.log(`\n➤  Migrating ${tag} (id: ${user.id})`);

        try {
            // ─ 2a. Upsert Stripe Customer ─────────────────────────────────────
            let customerId = user.stripeCustomerId;

            if (!customerId) {
                console.log('   ├─ No Stripe customer — creating...');
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
                    metadata: { userId: user.id },
                });
                customerId = customer.id;

                // Persist the new customer ID immediately so a mid-loop crash
                // doesn't create duplicate customers on the next run.
                await prisma.user.update({
                    where: { id: user.id },
                    data: { stripeCustomerId: customerId },
                });
                console.log(`   ├─ Stripe customer created: ${customerId}`);
            } else {
                console.log(`   ├─ Reusing existing Stripe customer: ${customerId}`);
            }

            // ─ 2b. Create Stripe Subscription with 30-day trial ───────────────
            // trial_period_days: 30 — the user is subscribed today but the first
            // real billing cycle only starts after the trial ends.
            console.log('   ├─ Creating Stripe subscription (30-day trial)...');
            const stripeSubscription = await stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: STRIPE_PRICE_29_MONTHLY! }],
                trial_period_days: 30,
                metadata: {
                    userId: user.id,
                    migratedAt: new Date().toISOString(),
                    migrationType: 'legacy_to_subscription',
                },
            });
            console.log(`   ├─ Stripe subscription created: ${stripeSubscription.id}`);

            // ─ 2c. Insert Subscription record in DB ───────────────────────────
            const now = new Date();
            const periodEnd = addDays(now, 30);

            await prisma.subscription.create({
                data: {
                    userId: user.id,
                    stripeSubscriptionId: stripeSubscription.id,
                    stripeCustomerId: customerId,
                    stripePriceId: STRIPE_PRICE_29_MONTHLY!,
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: periodEnd,
                    cancelAtPeriodEnd: false,
                },
            });

            const trialEnd = periodEnd.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
            console.log(`   └─ ✅  Success — ACTIVE subscription created, trial until ${trialEnd}`);
            successCount++;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`   └─ ❌  Failed: ${message}`);
            failCount++;
        }

        // Throttle to avoid hitting Stripe's rate limit (100 req/s for live, 25 in test)
        if (i < eligibleUsers.length - 1) {
            await sleep(DELAY_BETWEEN_USERS_MS);
        }
    }

    // ── Step 3: Summary ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(60));
    console.log('📊  Migration summary:');
    console.log(`    ✅  ${successCount} user(s) migrated successfully`);
    if (failCount > 0) {
        console.log(`    ❌  ${failCount} user(s) failed — review logs above`);
        console.log('    ℹ️   Re-run the script to retry failed users (idempotent).');
    }
    console.log('═'.repeat(60) + '\n');

    await prisma.$disconnect();
}

migrate().catch((err: unknown) => {
    console.error('\n💥  Fatal error:', err instanceof Error ? err.message : err);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any)
        .$disconnect()
        .catch(() => undefined)
        .finally(() => process.exit(1));
});
