/**
 * Test Script: Generation → Validation → Sanctuaire Flow
 * 
 * Run with: npx ts-node scripts/test-generation-flow.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = process.env.API_URL || 'http://localhost:3001';

interface TestResult {
    step: string;
    success: boolean;
    data?: any;
    error?: string;
}

const results: TestResult[] = [];

async function log(step: string, success: boolean, data?: any, error?: string) {
    const result = { step, success, data, error };
    results.push(result);
    const icon = success ? '✅' : '❌';
    console.log(`${icon} ${step}`);
    if (data) console.log('   Data:', JSON.stringify(data, null, 2).substring(0, 200));
    if (error) console.log('   Error:', error);
}

async function main() {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TEST: Generation → Validation → Sanctuaire Flow');
    console.log('='.repeat(60) + '\n');

    try {
        // =====================================================================
        // STEP 1: Check database connection
        // =====================================================================
        console.log('📊 Step 1: Database Connection');
        const userCount = await prisma.user.count();
        const orderCount = await prisma.order.count();
        await log('Database connected', true, { users: userCount, orders: orderCount });

        // =====================================================================
        // STEP 2: Find or create test user with profile
        // =====================================================================
        console.log('\n👤 Step 2: Test User Setup');
        
        let testUser = await prisma.user.findFirst({
            where: { email: 'test-generation@lumira.com' },
            include: { profile: true },
        });

        if (!testUser) {
            testUser = await prisma.user.create({
                data: {
                    email: 'test-generation@lumira.com',
                    firstName: 'Test',
                    lastName: 'Generation',
                    passwordHash: '$2b$10$dummyhashfortesting',
                    phone: '+33612345678',
                    dateOfBirth: new Date('1990-05-15'),
                    profile: {
                        create: {
                            birthDate: '1990-05-15',
                            birthTime: '14:30',
                            birthPlace: 'Paris, France',
                            specificQuestion: 'Quelle est ma mission de vie ?',
                            objective: 'Développement spirituel',
                            profileCompleted: true,
                        },
                    },
                },
                include: { profile: true },
            });
            await log('Test user created', true, { userId: testUser.id, email: testUser.email });
        } else {
            await log('Test user found', true, { userId: testUser.id, email: testUser.email });
        }

        // =====================================================================
        // STEP 3: Create or find PAID order
        // =====================================================================
        console.log('\n📦 Step 3: Order Setup');
        
        let testOrder = await prisma.order.findFirst({
            where: {
                userId: testUser.id,
                status: { in: ['PAID', 'PROCESSING', 'AWAITING_VALIDATION'] },
            },
        });

        if (!testOrder) {
            const orderNumber = `TEST-${Date.now()}`;
            testOrder = await prisma.order.create({
                data: {
                    userId: testUser.id,
                    orderNumber,
                    status: 'PAID',
                    level: 1,
                    amount: 29.00,
                    currency: 'EUR',
                    productName: 'Initié',
                    userName: `${testUser.firstName} ${testUser.lastName}`,
                    userEmail: testUser.email,
                },
            });
            await log('Test order created (PAID)', true, { 
                orderId: testOrder.id, 
                orderNumber: testOrder.orderNumber,
                status: testOrder.status,
            });
        } else {
            await log('Existing order found', true, { 
                orderId: testOrder.id, 
                orderNumber: testOrder.orderNumber,
                status: testOrder.status,
            });
        }

        // =====================================================================
        // STEP 4: Find or create expert
        // =====================================================================
        console.log('\n👨‍💼 Step 4: Expert Setup');
        
        let expert = await prisma.expert.findFirst({
            where: { role: 'ADMIN' },
        });

        if (!expert) {
            expert = await prisma.expert.create({
                data: {
                    email: 'admin-test@lumira.com',
                    passwordHash: '$2b$10$dummyhashfortesting',
                    firstName: 'Admin',
                    lastName: 'Test',
                    role: 'ADMIN',
                },
            });
            await log('Admin expert created', true, { expertId: expert.id });
        } else {
            await log('Admin expert found', true, { expertId: expert.id, email: expert.email });
        }

        // =====================================================================
        // STEP 5: Check current order status
        // =====================================================================
        console.log('\n📋 Step 5: Current Order Status');
        
        const currentOrder = await prisma.order.findUnique({
            where: { id: testOrder.id },
            select: {
                id: true,
                orderNumber: true,
                status: true,
                generatedContent: true,
                deliveredAt: true,
            },
        });

        await log('Order status check', true, {
            status: currentOrder?.status,
            hasContent: !!currentOrder?.generatedContent,
            delivered: !!currentOrder?.deliveredAt,
        });

        // =====================================================================
        // STEP 6: Check SpiritualPath
        // =====================================================================
        console.log('\n🌟 Step 6: Spiritual Path Check');
        
        const spiritualPath = await prisma.spiritualPath.findUnique({
            where: { userId: testUser.id },
            include: {
                steps: { orderBy: { dayNumber: 'asc' } },
            },
        });

        if (spiritualPath) {
            await log('Spiritual path exists', true, {
                pathId: spiritualPath.id,
                archetype: spiritualPath.archetype,
                stepsCount: spiritualPath.steps.length,
                steps: spiritualPath.steps.map(s => ({
                    day: s.dayNumber,
                    title: s.title?.substring(0, 30),
                    completed: s.isCompleted,
                })),
            });
        } else {
            await log('No spiritual path yet', true, { message: 'Will be created after generation' });
        }

        // =====================================================================
        // STEP 7: Summary
        // =====================================================================
        console.log('\n' + '='.repeat(60));
        console.log('📊 TEST SUMMARY');
        console.log('='.repeat(60));
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;
        
        console.log(`✅ Passed: ${successCount}`);
        console.log(`❌ Failed: ${failCount}`);
        
        console.log('\n📌 NEXT STEPS TO TEST MANUALLY:');
        console.log('─'.repeat(40));
        
        if (currentOrder?.status === 'PAID') {
            console.log(`
1. GENERATE AI CONTENT:
   POST ${API_URL}/api/expert/orders/${testOrder.id}/generate
   (Requires expert authentication)

2. CHECK STATUS:
   Order should move to AWAITING_VALIDATION
   Content should be populated

3. VALIDATE:
   POST ${API_URL}/api/expert/validate-content
   Body: { "orderId": "${testOrder.id}", "action": "approve" }

4. VERIFY SANCTUAIRE:
   GET ${API_URL}/api/client/readings
   GET ${API_URL}/api/client/spiritual-path
`);
        } else if (currentOrder?.status === 'AWAITING_VALIDATION') {
            console.log(`
Order is ready for VALIDATION!

VALIDATE NOW:
POST ${API_URL}/api/expert/validate-content
Body: { "orderId": "${testOrder.id}", "action": "approve" }
`);
        } else if (currentOrder?.status === 'COMPLETED') {
            console.log(`
Order is COMPLETED! ✅

CHECK SANCTUAIRE:
GET ${API_URL}/api/client/readings
GET ${API_URL}/api/client/spiritual-path
`);
        }

        console.log('\n🔑 Test IDs:');
        console.log(`   User ID: ${testUser.id}`);
        console.log(`   Order ID: ${testOrder.id}`);
        console.log(`   Expert ID: ${expert.id}`);

    } catch (error) {
        console.error('💥 Test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
