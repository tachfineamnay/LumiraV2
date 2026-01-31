/**
 * @fileoverview Gemini API Connection Test Script
 * 
 * Usage: 
 *   npx ts-node scripts/test-gemini-connection.ts
 *   npx ts-node scripts/test-gemini-connection.ts YOUR_API_KEY
 * 
 * This script validates your GEMINI_API_KEY and tests multiple model names
 * to find which ones are available.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env from api folder
dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });

// Also try root .env as fallback
dotenv.config({ path: path.join(__dirname, '../.env') });

import { GoogleGenerativeAI } from '@google/generative-ai';

// Models to test (in order of preference)
const MODELS_TO_TEST = [
    'gemini-2.5-flash',        // Current best price-performance (2026)
    'gemini-2.5-pro',          // Advanced thinking model
    'gemini-2.5-flash-lite',   // Ultra fast
    'gemini-2.0-flash',        // Deprecated but still available until March 2026
    'gemini-1.5-pro',          // Legacy - might be removed
    'gemini-1.5-flash',        // Legacy - might be removed
    'gemini-1.5-pro-latest',   // Legacy alias
    'gemini-1.5-flash-latest', // Legacy alias
];

async function testModel(genAI: GoogleGenerativeAI, modelName: string): Promise<boolean> {
    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: 'Réponds uniquement par "OK".' }] }],
        });
        
        const response = result.response.text();
        console.log(`✅ SUCCESS: ${modelName} → "${response.substring(0, 50)}..."`);
        return true;
    } catch (error: any) {
        const status = error?.status || error?.response?.status || 'unknown';
        const message = error?.message || error?.toString() || 'Unknown error';
        
        if (status === 404) {
            console.log(`❌ NOT FOUND (404): ${modelName}`);
        } else if (status === 403) {
            console.log(`🚫 FORBIDDEN (403): ${modelName} - API key might not have access`);
        } else if (status === 429) {
            console.log(`⏳ RATE LIMITED (429): ${modelName} - Try again later`);
        } else {
            console.log(`❌ FAILED: ${modelName} - ${message.substring(0, 100)}`);
        }
        return false;
    }
}

async function testJsonMode(genAI: GoogleGenerativeAI, modelName: string): Promise<boolean> {
    try {
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });
        
        const result = await model.generateContent({
            contents: [{ 
                role: 'user', 
                parts: [{ text: 'Génère un JSON avec { "status": "ok", "test": true }' }] 
            }],
        });
        
        const response = result.response.text();
        JSON.parse(response); // Will throw if not valid JSON
        console.log(`✅ JSON MODE OK: ${modelName}`);
        return true;
    } catch (error: any) {
        console.log(`❌ JSON MODE FAILED: ${modelName} - ${error.message?.substring(0, 80)}`);
        return false;
    }
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔮 GEMINI API CONNECTION TEST - Oracle Lumira');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const apiKey = process.argv[2] || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('❌ ERROR: GEMINI_API_KEY not found!');
        console.log('\nUsage:');
        console.log('  npx ts-node scripts/test-gemini-connection.ts YOUR_API_KEY');
        console.log('\nOr set GEMINI_API_KEY in:');
        console.log('  - apps/api/.env');
        console.log('  - .env (root)');
        process.exit(1);
    }

    console.log(`📍 API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`📍 Key prefix: ${apiKey.substring(0, 4)} (should be "AIza" for AI Studio)\n`);

    const genAI = new GoogleGenerativeAI(apiKey);

    console.log('───────────────────────────────────────────────────────────────');
    console.log('PHASE 1: Testing Model Availability');
    console.log('───────────────────────────────────────────────────────────────\n');

    const workingModels: string[] = [];

    for (const modelName of MODELS_TO_TEST) {
        const success = await testModel(genAI, modelName);
        if (success) {
            workingModels.push(modelName);
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n───────────────────────────────────────────────────────────────');
    console.log('PHASE 2: Testing JSON Mode (for SCRIBE/GUIDE agents)');
    console.log('───────────────────────────────────────────────────────────────\n');

    for (const modelName of workingModels.slice(0, 3)) { // Test top 3 working models
        await testJsonMode(genAI, modelName);
        await new Promise(r => setTimeout(r, 500));
    }

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY');
    console.log('═══════════════════════════════════════════════════════════════\n');

    if (workingModels.length === 0) {
        console.log('❌ No working models found!');
        console.log('\nPossible issues:');
        console.log('  1. API key is invalid or expired');
        console.log('  2. API key does not have Gemini API access enabled');
        console.log('  3. Network issues or Google API outage');
        console.log('\nVisit https://aistudio.google.com/apikey to check your key.');
    } else {
        console.log(`✅ Working models: ${workingModels.join(', ')}`);
        console.log(`\n🎯 RECOMMENDED for VertexOracle.ts:`);
        console.log(`   HEAVY_MODEL = '${workingModels[0]}'`);
        console.log(`   FLASH_MODEL = '${workingModels[0]}'`);
    }

    console.log('\n═══════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
