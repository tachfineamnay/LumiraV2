import type { Order } from '../types';

export type QualityStatus = 'PASS' | 'WARNING' | 'BLOCKED';

export interface QualityIssue {
  code: string;
  message: string;
  field?: string;
  severity: 'BLOCKING' | 'WARNING';
}

export interface QualityReport {
  status: QualityStatus;
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  metrics: {
    totalWords: number;
    sectionWordCounts: Record<string, number>;
    insightsCount: number;
    ritualsCount: number;
    instructionsCount: number;
  };
}

export interface StructuredSection {
  domain: string;
  title: string;
  content: string;
}

export interface StructuredRitual {
  name: string;
  description: string;
  instructions: string[];
}

export interface StructuredReading {
  pdf_content: {
    introduction: string;
    archetype_reveal: string;
    sections: StructuredSection[];
    karmic_insights: string[];
    life_mission: string;
    rituals: StructuredRitual[];
    conclusion: string;
  };
  synthesis: {
    archetype: string;
    keywords: string[];
    emotional_state: string;
    key_blockage: string;
  };
  timeline: Array<{
    day: number;
    title: string;
    action: string;
    mantra?: string;
    actionType?: string;
  }>;
  lecture: string;
}

export interface WorkspaceHistoryEvent {
  id: string;
  at: string;
  type: string;
  label: string;
  detail?: string;
  version?: number;
  status?: string;
}

export interface ReadingWorkspacePayload {
  order: Order;
  reading: StructuredReading | null;
  revision: number;
  quality: QualityReport | null;
  history: WorkspaceHistoryEvent[];
}
