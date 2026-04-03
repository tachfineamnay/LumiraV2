# Skill 25 — Audio Pipeline (TTS "La Voix du Guide")

## Overview

Full text-to-speech pipeline that generates audio readings for users. Converts AI-generated insight text into meditative spoken audio via LLM reformulation + Google Cloud TTS.

## Architecture

```
DigitalSoulService (fire-and-forget trigger)
  └── AudioGenerationService.generateAllAudio(orderId)
        ├── For each Insight (8 categories, batches of 3):
        │     └── reformulateText(text, 'insight', category)
        │           └── AudioScriptService.reformulate({text, type, category})  ← NARRATOR agent (Gemini 2.5 Flash)
        │     └── textToSsml(reformulatedText)
        │     └── synthesize(ssml, voice)  ← Google Cloud TTS (Neural2 or Journey)
        │     └── uploadToS3(mp3Buffer)
        │     └── prisma.insight.update({ audioUrl })
        │
        └── For synthesis (OrderFile PDF text):
              └── Same pipeline → prisma.orderFile.create({ type: 'AUDIO_READING' })
              └── deleteMany({ type: 'AUDIO_READING' }) before create (dedup on retry)
```

## Trigger Points

Audio generation is triggered **fire-and-forget** (errors caught silently) from `DigitalSoulService`:

1. **`finalizeWithPdf()`** — Expert approves order → Phase 2 completes → audio starts
2. **`processOrderGeneration()`** — Full auto pipeline (STEP 7) → audio starts

Both call:
```typescript
this.audioGenerationService?.generateAllAudio(orderId).catch(err =>
  this.logger.warn(`Audio generation failed for order ${orderId}`, err.message)
);
```

## Key Services

### AudioScriptService (`services/factory/AudioScriptService.ts`)

LLM-based text reformulation using Gemini 2.5 Flash with NARRATOR agent personality.

- **Purpose**: Transform PDF-style text into meditative narration scripts optimized for spoken delivery
- **Model**: `gemini-2.5-flash`, temperature 0.3
- **System prompt**: `NARRATOR_SYSTEM_PROMPT` — suppresses visual formatting (no colons, no bullets), uses tutoiement, adds transitions
- **Method**: `reformulate({ text, type, category? })` → `Promise<string>`
- **Timeout**: 20 seconds, falls back to raw text
- **Safety**: Rejects output < 30% of input length (returns raw text instead)
- **Graceful fallback**: If `GEMINI_API_KEY` is missing, service constructs but `reformulate()` returns raw text (passthrough mode)

### AudioGenerationService (`services/factory/AudioGenerationService.ts`)

Google Cloud TTS integration that generates MP3 files and stores them in S3.

- **TTS Client**: `@google-cloud/text-to-speech` v6.4.0
- **Voices**: `fr-FR-Neural2-A` (feminine) / `fr-FR-Neural2-D` (masculine), or Journey variants
- **SSML**: `textToSsml()` adds `<break>` tags, `<prosody>` for pacing
- **Storage**: Uploads to S3 bucket, stores URL in database
- **DB writes**:
  - `Insight.audioUrl` — one per insight category (8 total)
  - `OrderFile` with `type: 'AUDIO_READING'` — one for synthesis audio
- **Dependencies**: `@Optional() AudioScriptService` for reformulation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLOUD_TTS_KEY_JSON` | **Yes** (for audio) | Base64-encoded Google Cloud service account JSON with TTS API enabled |
| `GEMINI_API_KEY` | No (graceful fallback) | Needed for AudioScriptService NARRATOR reformulation. Without it, raw text goes to TTS |
| `TTS_USE_JOURNEY_VOICES` | No (default: `false`) | Set to `true` for Journey voices instead of Neural2 |
| `AWS_LECTURES_BUCKET_NAME` | No (fallback to `AWS_S3_BUCKET_NAME`) | Separate S3 bucket for audio files |

## Test Endpoint

```
POST /expert/test-audio/:orderId
Authorization: Bearer <expert_token>
Roles: ADMIN
```

Directly calls `audioGenerationService.generateAllAudio(orderId)` — bypasses DigitalSoulService orchestration.

## Silent Failure Points

All audio failures are **caught and logged** but never surface to users:

1. Fire-and-forget `.catch()` in DigitalSoulService triggers
2. `@Optional()` AudioGenerationService — if service can't construct, `this.audioGenerationService` is `undefined`
3. `@Optional()` AudioScriptService — if missing, reformulation is skipped (passthrough)
4. 20-second timeout in AudioScriptService → raw text fallback
5. TTS API errors → individual insight/synthesis skipped
6. S3 upload errors → audio URL not saved

**No `audioStatus` field on Order** — there's no way to query "did audio succeed?" from the DB. Monitor via application logs.

## Common Pitfalls

| Problem | Solution |
|---------|----------|
| No audio generated at all | Check `GOOGLE_CLOUD_TTS_KEY_JSON` env var is set and base64-encoded |
| Audio generated but sounds robotic/flat | Check `GEMINI_API_KEY` — without it, raw PDF text goes to TTS (no NARRATOR reformulation) |
| Duplicate AUDIO_READING files | Fixed with `deleteMany` before `create` — but check if old code is deployed |
| Audio works in `finalizeWithPdf` but not `processOrderGeneration` | Verify the fire-and-forget block exists at end of STEP 7 |
| `Cannot read properties of undefined` on audioGenerationService | Ensure `@Optional()` decorator is present AND null-check (`this.audioGenerationService?.`) |
