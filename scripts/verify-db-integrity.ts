/**
 * Database Integrity Verification Script
 * 
 * Tests the core data models by inserting and reading back:
 * - User with refId
 * - Order with orderNumber
 * - AkashicRecord with domains
 * - SystemSetting for dynamic API keys
 * - SequenceCounter for ID generation
 * 
 * Run with: npx ts-node scripts/verify-db-integrity.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Generate unique test identifiers
const TEST_PREFIX = `TEST_${Date.now()}`;
const TEST_REF_ID = `LUM-C-26-${TEST_PREFIX.slice(-4)}`;
const TEST_ORDER_NUMBER = `LUM-O-260127-${TEST_PREFIX.slice(-3)}`;
const TEST_EMAIL = `test_${TEST_PREFIX}@verify.local`;

interface VerificationResult {
  step: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: VerificationResult[] = [];

function log(message: string, type: 'info' | 'success' | 'error' = 'info') {
  const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : '📋';
  console.log(`${prefix} ${message}`);
}

async function verifyUserCreation(): Promise<string> {
  log('Creating test User with refId...');
  
  const user = await prisma.user.create({
    data: {
      email: TEST_EMAIL,
      firstName: 'Test',
      lastName: 'Verification',
      refId: TEST_REF_ID,
    },
  });

  // Read back
  const readUser = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (!readUser || readUser.refId !== TEST_REF_ID) {
    throw new Error('User refId verification failed');
  }

  results.push({
    step: 'User Creation & RefId',
    status: 'PASS',
    details: `Created user with refId: ${TEST_REF_ID}`,
  });

  log(`User created: ${user.id} (refId: ${TEST_REF_ID})`, 'success');
  return user.id;
}

async function verifyOrderCreation(userId: string): Promise<string> {
  log('Creating test Order with orderNumber...');
  
  const order = await prisma.order.create({
    data: {
      orderNumber: TEST_ORDER_NUMBER,
      userId: userId,
      userEmail: TEST_EMAIL,
      userName: 'Test Verification',
      level: 1,
      amount: 900, // 9€ in cents
      formData: {
        testField: 'verification',
        timestamp: new Date().toISOString(),
      },
    },
  });

  // Read back
  const readOrder = await prisma.order.findUnique({
    where: { id: order.id },
  });

  if (!readOrder || readOrder.orderNumber !== TEST_ORDER_NUMBER) {
    throw new Error('Order orderNumber verification failed');
  }

  results.push({
    step: 'Order Creation & OrderNumber',
    status: 'PASS',
    details: `Created order with orderNumber: ${TEST_ORDER_NUMBER}`,
  });

  log(`Order created: ${order.id} (orderNumber: ${TEST_ORDER_NUMBER})`, 'success');
  return order.id;
}

async function verifyAkashicRecordCreation(userId: string): Promise<string> {
  log('Creating test AkashicRecord with domains...');
  
  const testDomains = {
    relations: {
      summary: 'Test relationship insights',
      lastUpdated: new Date().toISOString(),
    },
    mission: {
      summary: 'Test life mission data',
      keywords: ['test', 'verification'],
    },
    sante: {
      summary: 'Test health insights',
    },
  };

  const testHistory = [
    {
      date: new Date().toISOString(),
      topic: 'Database Verification',
      insights: ['Test insight 1', 'Test insight 2'],
      sentiment: 'positive',
    },
  ];

  const akashicRecord = await prisma.akashicRecord.create({
    data: {
      userId: userId,
      archetype: 'Le Vérificateur',
      domains: testDomains,
      history: testHistory,
    },
  });

  // Read back
  const readRecord = await prisma.akashicRecord.findUnique({
    where: { id: akashicRecord.id },
  });

  if (!readRecord) {
    throw new Error('AkashicRecord creation failed');
  }

  // Verify JSON fields
  const domainsValid = JSON.stringify(readRecord.domains) === JSON.stringify(testDomains);
  const historyValid = JSON.stringify(readRecord.history) === JSON.stringify(testHistory);

  if (!domainsValid || !historyValid) {
    throw new Error('AkashicRecord JSON fields verification failed');
  }

  results.push({
    step: 'AkashicRecord Creation & JSON Fields',
    status: 'PASS',
    details: `Created AkashicRecord with domains: ${Object.keys(testDomains).join(', ')}`,
  });

  log(`AkashicRecord created: ${akashicRecord.id} (archetype: Le Vérificateur)`, 'success');
  return akashicRecord.id;
}

async function verifySystemSetting(): Promise<void> {
  log('Verifying SystemSetting model...');
  
  const testKey = `TEST_KEY_${TEST_PREFIX}`;
  const testValue = JSON.stringify({ verified: true, timestamp: Date.now() });

  const setting = await prisma.systemSetting.create({
    data: {
      key: testKey,
      value: testValue,
      isEncrypted: false,
    },
  });

  // Read back
  const readSetting = await prisma.systemSetting.findUnique({
    where: { key: testKey },
  });

  if (!readSetting || readSetting.value !== testValue) {
    throw new Error('SystemSetting verification failed');
  }

  // Cleanup
  await prisma.systemSetting.delete({ where: { id: setting.id } });

  results.push({
    step: 'SystemSetting CRUD',
    status: 'PASS',
    details: `Created, read, and deleted SystemSetting`,
  });

  log(`SystemSetting verified and cleaned up`, 'success');
}

async function verifySequenceCounter(): Promise<void> {
  log('Verifying SequenceCounter model...');
  
  const testName = `test_counter_${TEST_PREFIX}`;

  const counter = await prisma.sequenceCounter.create({
    data: {
      name: testName,
      value: 0,
    },
  });

  // Increment
  const updated = await prisma.sequenceCounter.update({
    where: { id: counter.id },
    data: { value: { increment: 1 } },
  });

  if (updated.value !== 1) {
    throw new Error('SequenceCounter increment failed');
  }

  // Cleanup
  await prisma.sequenceCounter.delete({ where: { id: counter.id } });

  results.push({
    step: 'SequenceCounter Increment',
    status: 'PASS',
    details: `Counter incremented from 0 to 1`,
  });

  log(`SequenceCounter verified and cleaned up`, 'success');
}

async function cleanup(userId: string): Promise<void> {
  log('Cleaning up test data...');
  
  // Delete in reverse order of dependencies
  await prisma.akashicRecord.deleteMany({ where: { userId } });
  await prisma.order.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  
  log('Test data cleaned up', 'success');
}

async function main(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 DATABASE INTEGRITY VERIFICATION');
  console.log('='.repeat(60) + '\n');

  let userId: string | null = null;

  try {
    // Test User creation
    userId = await verifyUserCreation();

    // Test Order creation
    await verifyOrderCreation(userId);

    // Test AkashicRecord creation
    await verifyAkashicRecordCreation(userId);

    // Test SystemSetting
    await verifySystemSetting();

    // Test SequenceCounter
    await verifySequenceCounter();

    // Cleanup
    await cleanup(userId);
    userId = null;

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 VERIFICATION SUMMARY');
    console.log('='.repeat(60) + '\n');

    results.forEach((r) => {
      const icon = r.status === 'PASS' ? '✅' : '❌';
      console.log(`${icon} ${r.step}: ${r.status}`);
      if (r.details) console.log(`   └─ ${r.details}`);
    });

    const passed = results.filter((r) => r.status === 'PASS').length;
    const total = results.length;
    
    console.log('\n' + '='.repeat(60));
    console.log(`✨ RESULT: ${passed}/${total} checks passed`);
    console.log('='.repeat(60) + '\n');

    if (passed === total) {
      console.log('🎉 DATABASE INTEGRITY: VERIFIED\n');
      process.exit(0);
    } else {
      console.log('⚠️  DATABASE INTEGRITY: ISSUES FOUND\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error);
    
    // Attempt cleanup on failure
    if (userId) {
      try {
        await cleanup(userId);
      } catch (cleanupError) {
        console.error('Cleanup also failed:', cleanupError);
      }
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
