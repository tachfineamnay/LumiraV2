import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { MEMORY_CATEGORIES, MemoryCandidate, SanitizedMemoryCandidate } from './memory.types';

const BLOCKED = [
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]?){8,}\d\b/,
  /\bhttps?:\/\//i,
  /\b(?:api[_ -]?key|token|secret|password|private key)\b/i,
  /\b(?:diagnostic|cancer|dépression|bipolaire|schizophrénie|médical)\b/i,
  /\b(?:sexuel|sexualité|viol|grossesse|intime)\b/i,
  /\b(?:iban|carte bancaire|numéro de carte|swift)\b/i,
  /\b(?:ignore|ignorer|instruction|système|system prompt|mémorise)\b/i,
];

@Injectable()
export class MemorySanitizerService {
  sanitize(candidates: unknown): SanitizedMemoryCandidate[] {
    if (!Array.isArray(candidates)) return [];
    const unique = new Map<string, SanitizedMemoryCandidate>();
    for (const raw of candidates.slice(0, 12)) {
      const candidate = raw as MemoryCandidate;
      if (!candidate || candidate.shouldPersist !== true || candidate.sensitive === true) continue;
      if (!MEMORY_CATEGORIES.includes(candidate.category as (typeof MEMORY_CATEGORIES)[number]))
        continue;
      const fact =
        typeof candidate.fact === 'string' ? candidate.fact.replace(/\s+/g, ' ').trim() : '';
      const confidence = Number(candidate.confidence);
      if (
        fact.length < 16 ||
        fact.length > 480 ||
        !Number.isFinite(confidence) ||
        confidence < 0 ||
        confidence > 1
      )
        continue;
      if (BLOCKED.some((pattern) => pattern.test(fact))) continue;
      const normalized = fact.toLocaleLowerCase('fr-FR');
      if (/^(?:aucun|rien|inconnu|non applicable)[.!]?$/i.test(fact)) continue;
      unique.set(this.hash(`${candidate.category}:${normalized}`), {
        category: candidate.category as SanitizedMemoryCandidate['category'],
        fact,
        confidence,
      });
    }
    return [...unique.values()];
  }

  hash(value: string): string {
    return createHash('sha256').update(value.normalize('NFKC')).digest('hex');
  }
}
