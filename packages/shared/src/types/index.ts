export interface User {
    id: string;
    email: string;
    createdAt: Date;
}

export type CatalogItem = {
    id: string;
    name: string;
    description?: string;
};

export enum SubscriptionStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    TRIAL = 'TRIAL',
}

export enum OrderStatus {
    PENDING = 'PENDING',
    PAID = 'PAID',
    PROCESSING = 'PROCESSING',
    AWAITING_VALIDATION = 'AWAITING_VALIDATION',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
}

export enum ProductOrderStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED',
}

export enum ExpertRole {
    EXPERT = 'EXPERT',
    ADMIN = 'ADMIN',
}

export enum ReviewStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    REVISION_NEEDED = 'REVISION_NEEDED',
}

export enum ValidationStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export enum AudioVoice {
    MASCULINE = 'MASCULINE',
    FEMININE = 'FEMININE',
}

export enum DeliveryFormat {
    EMAIL = 'EMAIL',
    WHATSAPP = 'WHATSAPP',
}

export enum FileType {
    FACE_PHOTO = 'FACE_PHOTO',
    PALM_PHOTO = 'PALM_PHOTO',
}

export enum ProductLevel {
    INITIE = 'INITIE',
    MYSTIQUE = 'MYSTIQUE',
    PROFOND = 'PROFOND',
    INTEGRALE = 'INTEGRALE',
}
