/**
 * @fileoverview Gemini Developer API connection test (via @google/genai)
 *
 * Usage:
 *   npx ts-node scripts/test-gemini-connection.ts
 *   npx ts-node scripts/test-gemini-connection.ts YOUR_API_KEY
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.join(__dirname, '../apps/api/.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const MODELS_TO_TEST = ['gemini-2.5-flash', 'gemini-2.5-pro'];

async function testModel(ai: GoogleGenAI, modelName: string): Promise<boolean> {
  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: 'Réponds uniquement par "OK".',
      config: { maxOutputTokens: 8 },
    });
    const text = result.text?.trim() ?? '';
    console.log(`  ✓ ${modelName}: ${text.slice(0, 40)}`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`  ✗ ${modelName}: ${message.slice(0, 120)}`);
    return false;
  }
}

async function main() {
  const apiKey = (process.argv[2] || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    console.error('GEMINI_API_KEY manquante.');
    process.exit(1);
  }

  const ai = new GoogleGenAI({ apiKey, vertexai: false });
  console.log('Gemini Developer API — test modèles Lumira\n');
  let ok = 0;
  for (const model of MODELS_TO_TEST) {
    if (await testModel(ai, model)) ok += 1;
  }
  console.log(`\n${ok}/${MODELS_TO_TEST.length} modèles OK`);
  process.exit(ok > 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
