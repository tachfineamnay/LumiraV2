// ============== ORDER TYPES ==============

export type OrderStatus = 
  | 'PENDING'
  | 'PAID'
  | 'PROCESSING'
  | 'AWAITING_VALIDATION'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

export type ProductLevel = 'INITIE' | 'MYSTIQUE' | 'PROFOND' | 'INTEGRALE';

export interface OrderFile {
  id: string;
  type: 'FACE_PHOTO' | 'PALM_PHOTO';
  url: string;
  filename: string;
}

export interface UserProfile {
  id: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  specificQuestion?: string;
  objective?: string;
  facePhotoUrl?: string;
  palmPhotoUrl?: string;
  highs?: string;
  lows?: string;
  fears?: string;
  rituals?: string;
}

export interface User {
  id: string;
  refId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  profile?: UserProfile;
}

export interface OracleResponse {
  pdf_content: {
    introduction: string;
    archetype_reveal: string;
    sections: Array<{
      domain: string;
      title: string;
      content: string;
    }>;
    karmic_insights?: string[];
    life_mission?: string;
    rituals?: Array<{
      name: string;
      description: string;
      frequency: string;
    }>;
    conclusion: string;
  };
  synthesis: {
    archetype: string;
    keywords?: string[];
    emotional_state?: string;
  };
  timeline: Array<{
    day: number;
    title: string;
    action: string;
    mantra?: string;
  }>;
  lecture?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  level: number;
  status: OrderStatus;
  amount: number;
  generatedContent?: OracleResponse | null;
  expertPrompt?: string;
  expertInstructions?: string;
  expertReview?: Record<string, unknown>;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  paidAt?: string;
  completedAt?: string;
  user: User;
  files: OrderFile[];
}

// ============== KANBAN TYPES ==============

export type KanbanColumnId = 'paid' | 'processing' | 'validation' | 'completed';

export interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  icon: string;
  color: string;
  statuses: OrderStatus[];
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'paid',
    title: 'Nouvelles',
    icon: '📥',
    color: 'amber',
    statuses: ['PAID'],
  },
  {
    id: 'processing',
    title: 'En cours',
    icon: '⚙️',
    color: 'blue',
    statuses: ['PROCESSING'],
  },
  {
    id: 'validation',
    title: 'Validation',
    icon: '👁',
    color: 'purple',
    statuses: ['AWAITING_VALIDATION'],
  },
  {
    id: 'completed',
    title: 'Terminées',
    icon: '✅',
    color: 'green',
    statuses: ['COMPLETED'],
  },
];

// ============== STATS TYPES ==============

export interface DeskStats {
  pendingCount: number;
  processingCount: number;
  validationCount: number;
  completedCount: number;
  completedToday: number;
  revenueToday: number;
  avgProcessingTime?: number;
}

// ============== SOCKET EVENTS ==============

export interface SocketEvents {
  // Server -> Client
  'connected': { expertId: string; connectedAt: string };
  'online-count': { count: number };
  'order:new': Order & { timestamp: string };
  'order:status-changed': {
    id: string;
    orderNumber: string;
    previousStatus: string;
    newStatus: string;
    timestamp: string;
  };
  'order:generation-complete': {
    orderId: string;
    orderNumber: string;
    success: boolean;
    error?: string;
    timestamp: string;
  };
  'order:sealed': {
    id: string;
    orderNumber: string;
    sealedBy: string;
    timestamp: string;
  };
  'order:viewer-joined': {
    orderId: string;
    expertId: string;
    expertEmail: string;
  };
  'order:viewer-left': {
    orderId: string;
    expertId: string;
  };
  'stats:update': DeskStats & { timestamp: string };
  'pong': { timestamp: number };

  // Client -> Server
  'order:focus': { orderId: string };
  'order:blur': { orderId: string };
  'editor:cursor': {
    orderId: string;
    position: number;
    selection?: { from: number; to: number };
  };
  'ping': void;
}

// ============== UI TYPES ==============

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  shortcut?: string;
  action: () => void;
}

export interface ActivityItem {
  id: string;
  type: 'order_new' | 'order_completed' | 'generation_done' | 'client_message';
  title: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ============== LEVEL CONFIG ==============

export const LEVEL_CONFIG = {
  1: { name: 'Initié', color: 'emerald', icon: '🌱' },
  2: { name: 'Mystique', color: 'blue', icon: '🔮' },
  3: { name: 'Profond', color: 'purple', icon: '💎' },
  4: { name: 'Intégral', color: 'amber', icon: '👑' },
} as const;

export const STATUS_CONFIG = {
  PENDING: { label: 'En attente', color: 'gray', icon: '⏳' },
  PAID: { label: 'Payée', color: 'amber', icon: '💳' },
  PROCESSING: { label: 'En cours', color: 'blue', icon: '⚙️' },
  AWAITING_VALIDATION: { label: 'Validation', color: 'purple', icon: '👁' },
  COMPLETED: { label: 'Terminée', color: 'green', icon: '✅' },
  FAILED: { label: 'Échouée', color: 'red', icon: '❌' },
  REFUNDED: { label: 'Remboursée', color: 'gray', icon: '↩️' },
} as const;
