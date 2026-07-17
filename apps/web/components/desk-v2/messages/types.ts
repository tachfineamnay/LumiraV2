export type GuidanceRequestStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING_CLIENT'
  | 'WAITING_EXPERT'
  | 'RESOLVED'
  | 'ARCHIVED';

export type GuidanceRequestCategory =
  | 'READING_CLARIFICATION'
  | 'SPECIFIC_SITUATION'
  | 'INTEGRATION_ADVICE'
  | 'OTHER';

export interface GuidanceMessage {
  id: string;
  senderType: 'CLIENT' | 'EXPERT' | 'SYSTEM';
  senderId?: string | null;
  senderName?: string | null;
  content: string;
  createdAt: string;
  readByClientAt?: string | null;
  readByExpertAt?: string | null;
}

export interface GuidanceRequest {
  id: string;
  subject: string;
  status: GuidanceRequestStatus;
  category: GuidanceRequestCategory;
  priority: 'NORMAL' | 'HIGH';
  assignedExpert: { id: string; name: string } | null;
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  relatedReading: { id: string; orderNumber: string | null } | null;
  unreadCount: number;
  messageCount: number;
  lastSender: 'CLIENT' | 'EXPERT' | 'SYSTEM' | null;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: GuidanceMessage[];
}
