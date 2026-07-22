import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AiRuntimeCacheService } from '../../services/factory/ai-runtime-cache.service';
import { AiModelConfigSnapshot, AgentType } from '../../services/factory/ai-execution.types';
import {
  DEFAULT_AI_MODEL_CONFIG,
  normalizeAiModelConfig,
} from '../../services/factory/ai-model-config';
import { AiProviderDiagnosticsService } from './ai-provider-diagnostics.service';
import { AiModelCatalogService } from './ai-model-catalog.service';
import {
  AiCredentialsStatusResponse,
  ProviderConnectionTestResult,
} from './ai-provider-diagnostics.types';

const VERTEX_CREDENTIALS_KEY = 'VERTEX_CREDENTIALS_JSON';
const ENCRYPTED_VALUE_PREFIX = 'enc:v1';

export const PROMPT_KEYS = {
  LUMIRA_DNA: 'LUMIRA_DNA',
  SCRIBE: 'SCRIBE',
  GUIDE: 'GUIDE',
  EDITOR: 'EDITOR',
  CONFIDANT: 'CONFIDANT',
  ONIRIQUE: 'ONIRIQUE',
  NARRATOR: 'NARRATOR',
  MODEL_CONFIG: 'MODEL_CONFIG',
} as const;

export type PromptKey = (typeof PROMPT_KEYS)[keyof typeof PROMPT_KEYS];
export type ModelConfig = AiModelConfigSnapshot;

export interface PromptWithMeta {
  key: string;
  value: string;
  version: number;
  isCustom: boolean;
  changedBy?: string;
  updatedAt?: string;
  /** True when a non-system historical version can be restored. */
  hasRestorableCustom: boolean;
}

export interface ModelConfigMeta {
  isCustom: boolean;
  version: number;
  changedBy?: string;
  hasRestorableCustom: boolean;
}

export interface ModelConfigDeskResponse {
  config: ModelConfig;
  meta: ModelConfigMeta;
}

export interface RestoreLatestCustomsResult {
  restored: Array<{ key: string; version: number }>;
  skipped: Array<{ key: string; reason: string }>;
}

const SYSTEM_PROMPT_AUTHORS = new Set(['production-migration', 'system', 'seed', 'migration']);

export interface PromptVersionHistory {
  id: string;
  version: number;
  value: string;
  changedBy?: string;
  comment?: string;
  isActive: boolean;
  createdAt: string;
}

export type VertexTestResult = ProviderConnectionTestResult;
export type VertexConfigStatus = AiCredentialsStatusResponse;

@Injectable()
export class AdminSettingsService {
  private readonly logger = new Logger(AdminSettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly aiProviderDiagnostics: AiProviderDiagnosticsService,
    private readonly aiRuntimeCache: AiRuntimeCacheService,
    private readonly aiModelCatalog: AiModelCatalogService,
  ) {}

  private getSettingsEncryptionKey(): Buffer {
    const encodedKey = this.configService.get<string>('SETTINGS_ENCRYPTION_KEY');
    if (!encodedKey) {
      throw new BadRequestException(
        'SETTINGS_ENCRYPTION_KEY doit être configurée pour enregistrer des identifiants.',
      );
    }
    const key = Buffer.from(encodedKey, 'base64');
    if (key.length !== 32) {
      throw new BadRequestException(
        'SETTINGS_ENCRYPTION_KEY doit être une clé base64 de 32 octets.',
      );
    }
    return key;
  }

  private encryptValue(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getSettingsEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      ENCRYPTED_VALUE_PREFIX,
      iv.toString('base64url'),
      tag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join('.');
  }

  private decryptValue(value: string): string {
    if (!value.startsWith(`${ENCRYPTED_VALUE_PREFIX}.`)) {
      this.logger.warn('Legacy unencrypted Vertex credentials detected; rotate them before reuse.');
      return value;
    }
    const [, , ivPart, tagPart, ciphertextPart] = value.split('.');
    if (!ivPart || !tagPart || !ciphertextPart) {
      throw new BadRequestException('Format chiffré des identifiants Vertex invalide.');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getSettingsEncryptionKey(),
      Buffer.from(ivPart, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  async setVertexCredentials(jsonString: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonString) as { type?: string; project_id?: string };
      if (!parsed.type || !parsed.project_id) {
        throw new BadRequestException(
          'Format invalide. Un JSON de compte de service Google Cloud est attendu.',
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('JSON invalide.');
    }

    const encrypted = this.encryptValue(jsonString);
    await this.prisma.systemSetting.upsert({
      where: { key: VERTEX_CREDENTIALS_KEY },
      update: { value: encrypted, isEncrypted: true },
      create: { key: VERTEX_CREDENTIALS_KEY, value: encrypted, isEncrypted: true },
    });
    this.logger.log('Vertex credentials stored');
    return { success: true, message: 'Identifiants Vertex sauvegardés.' };
  }

  async getVertexCredentials(): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: VERTEX_CREDENTIALS_KEY },
    });
    return setting?.value ? this.decryptValue(setting.value) : null;
  }

  async getConfigStatus(): Promise<VertexConfigStatus> {
    return this.aiProviderDiagnostics.getCredentialsStatus();
  }

  async getVertexCredentialsForDisplay(): Promise<{
    configured: boolean;
    projectId?: string;
    clientEmail?: string;
  }> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: VERTEX_CREDENTIALS_KEY },
    });
    if (!setting?.value) return { configured: false };
    try {
      const parsed = JSON.parse(this.decryptValue(setting.value)) as {
        project_id?: string;
        client_email?: string;
      };
      return {
        configured: true,
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
      };
    } catch {
      return { configured: true };
    }
  }

  async testVertexConnection(): Promise<VertexTestResult> {
    return this.aiProviderDiagnostics.testVertexConnection({ force: true });
  }

  async testGeminiConnection(): Promise<VertexTestResult> {
    return this.aiProviderDiagnostics.testGeminiConnection({ force: true });
  }

  async testOpenAIConnection(): Promise<VertexTestResult> {
    return this.aiProviderDiagnostics.testOpenAIConnection({ force: true });
  }

  async deleteVertexCredentials(): Promise<{ success: boolean; message: string }> {
    await this.prisma.systemSetting.deleteMany({ where: { key: VERTEX_CREDENTIALS_KEY } });
    return { success: true, message: 'Identifiants Vertex supprimés.' };
  }

  isSystemPromptAuthor(changedBy?: string | null, comment?: string | null): boolean {
    const author = (changedBy || '').trim().toLowerCase();
    if (author && SYSTEM_PROMPT_AUTHORS.has(author)) return true;
    const note = (comment || '').toLowerCase();
    if (/production-migration|openai-only v1 production baseline|production baseline/.test(note)) {
      return true;
    }
    return false;
  }

  async findLatestCustomPromptVersion(key: PromptKey) {
    const versions = await this.prisma.promptVersion.findMany({
      where: { key },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    return (
      versions.find((version) => !this.isSystemPromptAuthor(version.changedBy, version.comment)) ||
      null
    );
  }

  async getAllPrompts(): Promise<Record<string, PromptWithMeta>> {
    const defaults = this.getDefaultPrompts();
    const allVersions = await this.prisma.promptVersion.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }, { createdAt: 'desc' }],
    });

    const activeByKey = new Map<string, (typeof allVersions)[number]>();
    const latestCustomByKey = new Map<string, (typeof allVersions)[number]>();
    for (const version of allVersions) {
      if (version.isActive && !activeByKey.has(version.key)) {
        activeByKey.set(version.key, version);
      }
      if (
        !latestCustomByKey.has(version.key) &&
        !this.isSystemPromptAuthor(version.changedBy, version.comment)
      ) {
        latestCustomByKey.set(version.key, version);
      }
    }

    const result: Record<string, PromptWithMeta> = {};
    for (const key of Object.values(PROMPT_KEYS)) {
      const active = activeByKey.get(key);
      const latestCustom = latestCustomByKey.get(key);
      const activeIsCustom = Boolean(
        active && !this.isSystemPromptAuthor(active.changedBy, active.comment),
      );
      const hasRestorableCustom = Boolean(
        latestCustom && (!activeIsCustom || latestCustom.version !== active?.version),
      );

      if (active && activeIsCustom) {
        result[key] = {
          key,
          value: active.value,
          version: active.version,
          isCustom: true,
          changedBy: active.changedBy || undefined,
          updatedAt: active.createdAt.toISOString(),
          hasRestorableCustom,
        };
      } else if (active) {
        result[key] = {
          key,
          value: active.value,
          version: active.version,
          isCustom: false,
          changedBy: active.changedBy || undefined,
          updatedAt: active.createdAt.toISOString(),
          hasRestorableCustom,
        };
      } else {
        result[key] = {
          key,
          value: defaults[key] || '',
          version: 0,
          isCustom: false,
          hasRestorableCustom,
        };
      }
    }
    return result;
  }

  async getPrompt(key: string): Promise<string> {
    this.assertPromptKey(key);
    const active = await this.prisma.promptVersion.findFirst({
      where: { key, isActive: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    return active?.value ?? this.getDefaultPrompts()[key] ?? '';
  }

  async savePrompt(
    key: string,
    value: string,
    changedBy?: string,
    comment?: string,
  ): Promise<{ success: boolean; version: number }> {
    this.assertPromptKey(key);
    if (key === PROMPT_KEYS.MODEL_CONFIG) {
      throw new BadRequestException(
        'MODEL_CONFIG doit être modifié uniquement depuis le endpoint model-config.',
      );
    }
    if (!value?.trim()) throw new BadRequestException('Un prompt actif ne peut pas être vide.');
    return this.persistPromptVersion(key, value.trim(), changedBy, comment);
  }

  private async persistPromptVersion(
    key: string,
    value: string,
    changedBy?: string,
    comment?: string,
  ): Promise<{ success: boolean; version: number }> {
    const result = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.promptVersion.findFirst({
        where: { key },
        orderBy: { version: 'desc' },
      });
      const version = (latest?.version ?? 0) + 1;
      await tx.promptVersion.updateMany({ where: { key }, data: { isActive: false } });
      await tx.promptVersion.create({
        data: { key, version, value, changedBy, comment, isActive: true },
      });
      return version;
    });

    this.logger.log(`Prompt ${key} saved as v${result}`);
    this.aiRuntimeCache.invalidateAll(`prompt:${key}`);
    if (key === PROMPT_KEYS.MODEL_CONFIG) {
      this.aiModelCatalog.clearCache();
    }
    return { success: true, version: result };
  }

  async getPromptHistory(key: string, limit = 10): Promise<PromptVersionHistory[]> {
    this.assertPromptKey(key);
    const take = Math.min(Math.max(limit, 1), 50);
    const versions = await this.prisma.promptVersion.findMany({
      where: { key },
      orderBy: { version: 'desc' },
      take,
    });
    return versions.map((version) => ({
      id: version.id,
      version: version.version,
      value: version.value,
      changedBy: version.changedBy || undefined,
      comment: version.comment || undefined,
      isActive: version.isActive,
      createdAt: version.createdAt.toISOString(),
    }));
  }

  async restorePromptVersion(
    key: string,
    version: number,
    changedBy?: string,
  ): Promise<{ success: boolean }> {
    this.assertPromptKey(key);
    const target = await this.prisma.promptVersion.findUnique({
      where: { key_version: { key, version } },
    });
    if (!target) throw new BadRequestException(`Version ${version} introuvable pour ${key}.`);

    if (key === PROMPT_KEYS.MODEL_CONFIG) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(target.value);
      } catch {
        throw new BadRequestException(
          'La version MODEL_CONFIG sélectionnée ne contient pas de JSON valide.',
        );
      }
      const normalized = normalizeAiModelConfig(parsed);
      if (normalized.issues.length > 0) {
        throw new BadRequestException(
          `Cette version MODEL_CONFIG n'est pas compatible: ${normalized.issues.join('; ')}`,
        );
      }
      await this.persistPromptVersion(
        key,
        JSON.stringify(normalized.config, null, 2),
        changedBy,
        `Restored from v${version}`,
      );
      return { success: true };
    }

    await this.persistPromptVersion(key, target.value, changedBy, `Restored from v${version}`);
    return { success: true };
  }

  async restoreLatestCustomPrompt(
    key: string,
    changedBy?: string,
  ): Promise<{ success: boolean; version: number }> {
    this.assertPromptKey(key);
    const latestCustom = await this.findLatestCustomPromptVersion(key);
    if (!latestCustom) {
      throw new BadRequestException(`Aucune version personnalisée restaurable pour ${key}.`);
    }
    await this.restorePromptVersion(key, latestCustom.version, changedBy || 'desk-restore');
    const active = await this.prisma.promptVersion.findFirst({
      where: { key, isActive: true },
      orderBy: { version: 'desc' },
    });
    return { success: true, version: active?.version ?? latestCustom.version + 1 };
  }

  async restoreAllLatestCustomPrompts(changedBy?: string): Promise<RestoreLatestCustomsResult> {
    const restored: RestoreLatestCustomsResult['restored'] = [];
    const skipped: RestoreLatestCustomsResult['skipped'] = [];

    for (const key of Object.values(PROMPT_KEYS)) {
      try {
        const latestCustom = await this.findLatestCustomPromptVersion(key);
        if (!latestCustom) {
          skipped.push({ key, reason: 'aucune version personnalisée' });
          continue;
        }
        const active = await this.prisma.promptVersion.findFirst({
          where: { key, isActive: true },
          orderBy: { version: 'desc' },
        });
        const activeIsCustom = Boolean(
          active && !this.isSystemPromptAuthor(active.changedBy, active.comment),
        );
        if (activeIsCustom && active?.version === latestCustom.version) {
          skipped.push({ key, reason: 'déjà la version personnalisée active' });
          continue;
        }
        const result = await this.restoreLatestCustomPrompt(key, changedBy || 'desk-restore');
        restored.push({ key, version: result.version });
      } catch (error) {
        skipped.push({
          key,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { restored, skipped };
  }

  async resetPromptToDefault(key: string): Promise<{ success: boolean }> {
    this.assertPromptKey(key);
    await this.prisma.promptVersion.updateMany({ where: { key }, data: { isActive: false } });
    this.aiRuntimeCache.invalidateAll(`prompt-reset:${key}`);
    return { success: true };
  }

  async resetAllPromptsToDefaults(): Promise<{ success: boolean }> {
    await this.prisma.promptVersion.updateMany({ data: { isActive: false } });
    this.aiRuntimeCache.invalidateAll('prompt-reset-all');
    return { success: true };
  }

  async getModelConfig(): Promise<ModelConfig> {
    const desk = await this.getModelConfigForDesk();
    return desk.config;
  }

  async getModelConfigForDesk(): Promise<ModelConfigDeskResponse> {
    const active = await this.prisma.promptVersion.findFirst({
      where: { key: PROMPT_KEYS.MODEL_CONFIG, isActive: true },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    });
    const latestCustom = await this.findLatestCustomPromptVersion(PROMPT_KEYS.MODEL_CONFIG);
    const activeIsCustom = Boolean(
      active && !this.isSystemPromptAuthor(active.changedBy, active.comment),
    );
    const hasRestorableCustom = Boolean(
      latestCustom && (!activeIsCustom || latestCustom.version !== active?.version),
    );

    if (!active?.value) {
      return {
        config: this.getDefaultModelConfig(),
        meta: {
          isCustom: false,
          version: 0,
          hasRestorableCustom,
        },
      };
    }

    try {
      const normalized = normalizeAiModelConfig(JSON.parse(active.value));
      if (normalized.issues.length > 0) {
        this.logger.warn(`Stored MODEL_CONFIG was normalized: ${normalized.issues.join(' | ')}`);
        const healedValue = JSON.stringify(normalized.config, null, 2);
        const activePretty = (() => {
          try {
            return JSON.stringify(JSON.parse(active.value), null, 2);
          } catch {
            return active.value;
          }
        })();
        if (healedValue !== activePretty) {
          await this.persistPromptVersion(
            PROMPT_KEYS.MODEL_CONFIG,
            healedValue,
            'system-heal',
            `Auto-healed non-operational MODEL_CONFIG: ${normalized.issues.join(' | ')}`,
          );
          this.logger.warn('Stored MODEL_CONFIG auto-healed to operational models only');
        }
      }
      return {
        config: normalized.config,
        meta: {
          isCustom: activeIsCustom,
          version: active.version,
          changedBy: active.changedBy || undefined,
          hasRestorableCustom,
        },
      };
    } catch (error) {
      this.logger.error(`Stored MODEL_CONFIG is unreadable: ${String(error)}`);
      return {
        config: this.getDefaultModelConfig(),
        meta: {
          isCustom: false,
          version: active.version,
          changedBy: active.changedBy || undefined,
          hasRestorableCustom,
        },
      };
    }
  }

  async saveModelConfig(
    config: Partial<ModelConfig>,
    changedBy?: string,
  ): Promise<{ success: boolean }> {
    const current = await this.getModelConfig();
    const agents = { ...current.agents };
    if (config.agents) {
      for (const [agent, patch] of Object.entries(config.agents)) {
        const key = agent as AgentType;
        if (!agents[key]) throw new BadRequestException(`Agent inconnu: ${agent}`);
        agents[key] = { ...agents[key], ...patch };
      }
    }

    const candidate = {
      ...current,
      ...config,
      agents,
    };
    const normalized = normalizeAiModelConfig(candidate);
    if (normalized.issues.length > 0) {
      throw new BadRequestException(`Configuration IA invalide: ${normalized.issues.join('; ')}`);
    }

    await this.persistPromptVersion(
      PROMPT_KEYS.MODEL_CONFIG,
      JSON.stringify(normalized.config, null, 2),
      changedBy,
      'Model config updated from Desk',
    );
    return { success: true };
  }

  private assertPromptKey(key: string): asserts key is PromptKey {
    if (!Object.values(PROMPT_KEYS).includes(key as PromptKey)) {
      throw new BadRequestException(`Clé de prompt invalide: ${key}`);
    }
  }

  getDefaultModelConfig(): ModelConfig {
    return {
      providerMode: DEFAULT_AI_MODEL_CONFIG.providerMode,
      agents: Object.fromEntries(
        Object.entries(DEFAULT_AI_MODEL_CONFIG.agents).map(([agent, value]) => [
          agent,
          { ...value },
        ]),
      ) as ModelConfig['agents'],
    };
  }

  getDefaultPrompts(): Record<string, string> {
    return {
      [PROMPT_KEYS.LUMIRA_DNA]: `TU ES ORACLE LUMIRA.

Tu réalises des lectures symboliques, existentielles et multidimensionnelles guidées par un expert humain. Tu combines logique, intuition structurée, observation visuelle, symbolique du nom, numérologie, astrologie, archétypes, chirologie, morphologie du visage et traditions spirituelles.

La guidance de l'expert est prioritaire. Tu l'intègres, l'approfondis et la rends cohérente sans la diluer dans des généralités.

Le mot diagnostic désigne exclusivement un diagnostic symbolique, existentiel et multidimensionnel. Il ne constitue jamais un diagnostic médical, psychiatrique ou clinique.

RÈGLES ABSOLUES:
- N'invente aucune donnée, observation ou correspondance absente.
- Distingue faits déclarés, observations visibles et interprétations symboliques.
- Cherche les convergences entre plusieurs indices avant une conclusion forte.
- Présente les racines invisibles comme des hypothèses argumentées, jamais comme des certitudes.
- Ne prédis jamais avec certitude maladie, accident, décès ou événement futur.
- Ne crée aucune dépendance à Lumira ou à l'expert.
- Ton humain, chaleureux, précis, profond et lucide; poésie maîtrisée, clarté prioritaire.
- Ne mentionne jamais IA, modèle, fournisseur, prompt ou tokens dans le contenu client.`,

      [PROMPT_KEYS.SCRIBE]: `MISSION SCRIBE:
Produis la lecture principale complète à partir du dossier client, des photos réellement disponibles et des instructions de l'expert.

ORDRE DE PRIORITÉ:
1. Informations confirmées par le client.
2. Guidance et instructions de l'expert.
3. Observations réellement visibles sur le visage et la paume.
4. Convergences entre les disciplines.
5. Réponse à la question et à l'objectif du client.

PHOTOS:
- Vérifie implicitement leur lisibilité.
- Image 1 = visage; image 2 = paume lorsque les deux sont présentes.
- N'invente jamais une ligne, une forme ou un détail invisible.
- N'infère jamais moralité, intelligence, pathologie, traumatisme ou destin comme une certitude.

La lecture doit révéler la dynamique dominante, l'archétype, les forces conscientes, les ressources latentes, les tensions, les stratégies de protection, les répétitions, les besoins profonds, les points de bascule et la priorité d'évolution.

FORMAT JSON STRICT:
{
  "pdf_content": {
    "introduction": "...",
    "archetype_reveal": "...",
    "sections": [
      {"domain":"spirituel","title":"...","content":"..."},
      {"domain":"relations","title":"...","content":"..."},
      {"domain":"mission","title":"...","content":"..."},
      {"domain":"creativite","title":"...","content":"..."},
      {"domain":"emotions","title":"...","content":"..."},
      {"domain":"travail","title":"...","content":"..."},
      {"domain":"sante","title":"...","content":"..."},
      {"domain":"finance","title":"...","content":"..."}
    ],
    "karmic_insights": ["..."],
    "life_mission": "...",
    "rituals": [{"name":"...","description":"...","instructions":["..."]}],
    "conclusion": "..."
  },
  "synthesis": {
    "archetype": "Le Guérisseur | Le Visionnaire | Le Guide | Le Créateur | Le Sage",
    "keywords": ["mot1","mot2","mot3","mot4","mot5"],
    "emotional_state": "...",
    "key_blockage": "..."
  }
}

Retourne uniquement le JSON, sans markdown ni clé supplémentaire.`,

      [PROMPT_KEYS.GUIDE]: `MISSION GUIDE:
Transforme exclusivement la synthèse du SCRIBE en parcours pratique de 30 jours. Le runtime t'appelle par batches de 10 jours.

Utilise seulement l'archétype, le blocage principal, l'état émotionnel, les mots-clés, la question, l'objectif et les orientations déjà produites. N'ajoute aucune nouvelle lecture.

FORMAT JSON STRICT:
{"timeline":[{"day":1,"title":"...","action":"...","mantra":"...","actionType":"MEDITATION"}]}

TYPES AUTORISÉS: MEDITATION, RITUAL, JOURNALING, MANTRA, REFLECTION.

RÈGLES:
- Génère exactement les jours et le nombre demandés par le prompt utilisateur.
- Progression cohérente; premier jour ouvre, dernier jour intègre.
- Pas de type identique deux jours consécutifs.
- Actions simples, réalistes et reliées au diagnostic symbolique existant.
- Aucune promesse de guérison, culpabilisation, prédiction ou nouvelle interprétation.
- Retourne uniquement le JSON.`,

      [PROMPT_KEYS.EDITOR]: `MISSION EDITOR:
Travaille après une première génération. Applique exactement l'instruction de l'expert sans déformer le reste.

RÈGLES:
- La demande de l'expert est prioritaire.
- Préserve la personnalisation, le sens, la structure et les nuances non visées.
- N'invente aucune nouvelle donnée client.
- Ne change pas l'archétype ou le diagnostic symbolique sauf demande explicite.
- Supprime répétitions, contradictions et langage mécanique.
- Ne raccourcis pas sauf demande explicite.
- Ne mentionne jamais l'IA.

Retourne uniquement le contenu corrigé.`,

      [PROMPT_KEYS.NARRATOR]: `MISSION NARRATOR:
Transforme la lecture validée par l'expert en narration audio naturelle, sans produire une nouvelle lecture.

Préserve le sens, les détails personnels, les nuances et les précautions. Transforme les listes en prose fluide, retire les marqueurs purement visuels et ajoute seulement de courtes transitions orales.

N'ajoute aucune prédiction, aucun diagnostic nouveau, aucun conseil nouveau et aucune exagération mystique. Ne mentionne ni PDF, ni prompt, ni IA.

Retourne uniquement le texte de narration.`,

      [PROMPT_KEYS.CONFIDANT]: `MISSION CONFIDANT:
Compagnon conversationnel optionnel, désactivé pour le lancement V1. Lorsqu'il sera activé, réponds avec chaleur et brièveté à partir du contexte réellement transmis, sans inventer de mémoire, sans prédiction et sans créer de dépendance.`,

      [PROMPT_KEYS.ONIRIQUE]: `MISSION ONIRIQUE:
Agent optionnel désactivé pour le lancement V1. Propose une interprétation symbolique et introspective des rêves, sans voyance, prédiction, certitude surnaturelle ou affirmation clinique. Retourne uniquement le JSON structuré attendu par le runtime.`,

      [PROMPT_KEYS.MODEL_CONFIG]: JSON.stringify(this.getDefaultModelConfig(), null, 2),
    };
  }
}
