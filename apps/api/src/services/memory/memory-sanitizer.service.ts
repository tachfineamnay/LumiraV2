import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { MEMORY_CATEGORIES, MemoryCandidate, SanitizedMemoryCandidate } from './memory.types';

const BLOCKED = [
  /\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/i,
  /\b(?:\+?\d[\s().-]?){8,}\d\b/,
  /\b(?:https?:\/\/|www\.)\S+/i,
  /\b(?:api[_ -]?key|access[_ -]?key|token|secret|password|mot de passe|private key|clé privée|bearer)\b/i,
  /\b(?:iban|bic|swift|carte bancaire|numéro de carte|credit card|tarjeta bancaria|account number)\b/i,
  /\b(?:\d[ -]*?){13,19}\b/,
  /\b(?:diagnostic|cancer|dépression|depression|bipolaire|bipolar|schizophrénie|schizophrenia|médical|medical|medico|maladie|disease|enfermedad|traitement|treatment|medicación)\b/i,
  /\b(?:sexuel|sexualité|sexual|viol|violence sexuelle|grossesse|pregnancy|embarazo|intime|abuse|abus)\b/i,
  /\b(?:né\.?e? le|date de naissance|born on|birth ?date|fecha de nacimiento)\b/i,
  /\b(?:0?[1-9]|[12]\d|3[01])\s*(?:\/|-|\.)\s*(?:0?[1-9]|1[0-2])\s*(?:\/|-|\.)\s*(?:19|20)\d{2}\b/,
  /\b(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[A-Z]{2}\d{2}[A-Z0-9]{10,30})\b/i,
  /\b(?:ignore|ignorer|ignorez|instruction|consigne|système|system prompt|prompt système|forget previous|olvida|mémorise|memorize|exfiltrate)\b/i,
  /\b(?:prédiction|prediction|prophétie|prophesy|avenir certain|will happen|va forcément|sera forcément)\b/i,
  /\b(?:M\.?|Mme|Monsieur|Madame|Mr\.?|Mrs\.?|Dr\.?)\s+[A-ZÀ-ÖØ-Ý][\p{L}'’-]{1,}(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}'’-]{1,})+/u,
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
      if (
        /^(?:aucun|rien|inconnu|non applicable|n\/a|sans information|pas d'information)[.!]?$/i.test(
          fact,
        ) ||
        /^(?:la personne|le client|la cliente)\s+(?:est|a|semble)\s+(?:bien|normal|spirituel|sensible)[.!]?$/i.test(
          fact,
        )
      )
        continue;
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
