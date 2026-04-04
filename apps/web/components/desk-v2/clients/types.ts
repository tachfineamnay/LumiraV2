// Types for Client 360 "Dossier d'Âme" CRM
import { OrderStatus } from '../types';

export interface ClientProfile {
  id: string;
  birthDate?: string | null;
  birthTime?: string | null;
  birthPlace?: string | null;
  specificQuestion?: string | null;
  objective?: string | null;
  facePhotoUrl?: string | null;
  palmPhotoUrl?: string | null;
  highs?: string | null;
  lows?: string | null;
  strongSide?: string | null;
  weakSide?: string | null;
  strongZone?: string | null;
  weakZone?: string | null;
  healthConcerns?: string | null;
  fears?: string | null;
  rituals?: string | null;
  isComplete: boolean;
}

export interface ClientOrder {
  id: string;
  orderNumber: string;
  level: number;
  status: OrderStatus;
  amount: number;
  generatedContent?: Record<string, unknown> | null;
  expertPrompt?: string | null;
  expertInstructions?: string | null;
  addons?: Array<{ type: string; amount: number; paidAt?: string }> | null;
  upsellOfferedAt?: string | null;
  upsellAcceptedAt?: string | null;
  createdAt: string;
  paidAt?: string | null;
  deliveredAt?: string | null;
  files: Array<{
    id: string;
    type: string;
    url: string;
    filename: string;
  }>;
}

export interface AkashicRecord {
  id: string;
  archetype?: string | null;
  domainData: Record<string, unknown>;
  interactionHistory: Array<{
    date: string;
    type: string;
    summary: string;
  }>;
}

export interface Insight {
  id: string;
  category: InsightCategory;
  summary: string;
  fullText: string;
  audioUrl?: string | null;
  viewedAt?: string | null;
  createdAt: string;
}

export type InsightCategory = 
  | 'SPIRITUEL'
  | 'RELATIONS'
  | 'MISSION'
  | 'CREATIVITE'
  | 'EMOTIONS'
  | 'TRAVAIL'
  | 'SANTE'
  | 'FINANCE';

export interface SpiritualPath {
  id: string;
  archetype?: string | null;
  synthesis?: string | null;
  keyBlockage?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  steps: Array<{
    id: string;
    dayNumber: number;
    title: string;
    description?: string | null;
    isCompleted: boolean;
  }>;
}

export interface ChatSession {
  id: string;
  title?: string | null;
  messagesCount: number;
  lastMessageAt?: string | null;
  createdAt: string;
}

export interface ClientSubscription {
  id: string;
  status: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
}

export interface ClientDream {
  id: string;
  content: string;
  emotion?: string | null;
  symbols: string[];
  linkedInsightId?: string | null;
  createdAt: string;
}

export interface UpsellHistoryItem {
  orderId: string;
  type: string;
  offeredAt?: string | null;
  acceptedAt?: string | null;
}

export interface ClientStats {
  totalOrders: number;
  completedOrders: number;
  totalSpent: number;
  totalSpentFormatted: string;
  favoriteLevel: string | null;
  highestLevel: string | null;
  highestLevelNumber: number;
  lastOrderAt: string | null;
  isVip: boolean;
  memberSince: string;
  // Engagement
  engagementScore: number;
  stepsCompleted: number;
  stepsTotal: number;
  insightsViewed: number;
  insightsTotal: number;
  chatMessagesTotal: number;
  dreamsCount: number;
  // Recency
  daysSinceLastActivity: number | null;
  lastActivityType: string;
  // Content
  audioCoverage: number;
  profileCompleteness: number;
  archetype: string | null;
  // Subscription
  subscriptionStatus: string;
  subscriptionDaysLeft: number | null;
  // Upsell
  upsellHistory: UpsellHistoryItem[];
}

export interface ClientFullData {
  id: string;
  refId?: string | null;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  crmNotes?: string | null;
  crmTags: string[];
  createdAt: string;
  updatedAt: string;
  profile?: ClientProfile | null;
  orders: ClientOrder[];
  subscription?: ClientSubscription | null;
  dreams: ClientDream[];
  akashicRecord?: AkashicRecord | null;
  spiritualPath?: SpiritualPath | null;
  chatSessions: ChatSession[];
  insights: Insight[];
  stats: ClientStats;
}

// Insight category configuration
export const INSIGHT_CATEGORIES: Record<InsightCategory, { label: string; icon: string; color: string }> = {
  SPIRITUEL: { label: 'Spirituel', icon: '🔮', color: 'purple' },
  RELATIONS: { label: 'Relations', icon: '💕', color: 'pink' },
  MISSION: { label: 'Mission de Vie', icon: '🎯', color: 'amber' },
  CREATIVITE: { label: 'Créativité', icon: '🎨', color: 'orange' },
  EMOTIONS: { label: 'Émotions', icon: '💫', color: 'blue' },
  TRAVAIL: { label: 'Carrière', icon: '💼', color: 'emerald' },
  SANTE: { label: 'Santé', icon: '🌿', color: 'green' },
  FINANCE: { label: 'Finances', icon: '💰', color: 'yellow' },
};
