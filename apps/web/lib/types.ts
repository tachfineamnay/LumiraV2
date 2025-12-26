export interface Order {
    id: string;
    orderNumber: string;
    userName: string | null;
    userEmail: string;
    level: number;
    amount: number;
    status: string;
    createdAt: string;
    deliveredAt?: string;
    formData?: Record<string, unknown>;
    generatedContent?: {
        lecture?: string;
        audio?: string;
        mandala?: string;
        rituals?: string[];
        generatedAt?: string;
    };
    revisionCount?: number;
    user?: {
        id?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
        profile?: {
            birthDate?: string;
            birthTime?: string;
            birthPlace?: string;
            specificQuestion?: string;
            objective?: string;
        };
    };
}

export interface Client {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string | null;
    createdAt: string;
    _count?: { orders: number };
}

export interface ClientStatsData {
    totalOrders: number;
    completedOrders: number;
    totalSpent: number;
    favoriteLevel: string | null;
    lastOrderAt: string | null;
}
