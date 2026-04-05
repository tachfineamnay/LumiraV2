/**
 * Test Fixtures Factory — Generates realistic test data for Sanctuaire audit tests.
 * All factories return objects with sensible defaults, overridable via partial params.
 */

// =============================================================================
// USER
// =============================================================================

export interface TestUser {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    stripeCustomerId: string | null;
    createdAt: string;
    updatedAt: string;
}

let userCounter = 0;

export function createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    userCounter++;
    return {
        id: `user-${userCounter}-${Date.now()}`,
        email: `user${userCounter}@test-lumira.com`,
        firstName: 'Marie',
        lastName: 'Dubois',
        phone: '+33612345678',
        stripeCustomerId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// =============================================================================
// USER PROFILE
// =============================================================================

export interface TestUserProfile {
    userId: string;
    birthDate: string | null;
    birthTime: string | null;
    birthPlace: string | null;
    specificQuestion: string | null;
    objective: string | null;
    facePhotoUrl: string | null;
    palmPhotoUrl: string | null;
    highs: string | null;
    lows: string | null;
    strongSide: string | null;
    weakSide: string | null;
    strongZone: string | null;
    weakZone: string | null;
    deliveryStyle: string | null;
    pace: number | null;
    ailments: string | null;
    fears: string | null;
    rituals: string | null;
    profileCompleted: boolean;
    submittedAt: string | null;
}

export function createTestProfile(userId: string, overrides: Partial<TestUserProfile> = {}): TestUserProfile {
    return {
        userId,
        birthDate: '1990-06-15',
        birthTime: '14:30',
        birthPlace: 'Lyon, France',
        specificQuestion: 'Quelle est ma mission de vie ?',
        objective: 'Croissance spirituelle',
        facePhotoUrl: null,
        palmPhotoUrl: null,
        highs: 'Méditation quotidienne, lecture',
        lows: 'Anxiété, insomnie',
        strongSide: 'droite',
        weakSide: 'gauche',
        strongZone: 'cœur',
        weakZone: 'gorge',
        deliveryStyle: 'poétique',
        pace: 3,
        ailments: 'Migraines occasionnelles',
        fears: 'Abandon, solitude',
        rituals: 'Méditation au lever du soleil',
        profileCompleted: true,
        submittedAt: new Date().toISOString(),
        ...overrides,
    };
}

// =============================================================================
// ORDER
// =============================================================================

export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'AWAITING_VALIDATION' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface TestOrder {
    id: string;
    orderNumber: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
    status: OrderStatus;
    amount: number;
    level: number;
    deliveredAt: string | null;
    createdAt: string;
    updatedAt: string;
}

let orderCounter = 0;

export function createTestOrder(overrides: Partial<TestOrder> = {}): TestOrder {
    orderCounter++;
    const now = new Date();
    const orderNum = `LU${now.getFullYear().toString().slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(orderCounter).padStart(3, '0')}`;
    return {
        id: `order-${orderCounter}-${Date.now()}`,
        orderNumber: orderNum,
        userId: 'user-1',
        email: 'user1@test-lumira.com',
        firstName: 'Marie',
        lastName: 'Dubois',
        status: 'COMPLETED',
        amount: 2900, // cents
        level: 1,
        deliveredAt: now.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        ...overrides,
    };
}

// =============================================================================
// INSIGHT
// =============================================================================

export type InsightCategory = 'SPIRITUEL' | 'RELATIONS' | 'MISSION' | 'CREATIVITE' | 'EMOTIONS' | 'TRAVAIL' | 'SANTE' | 'FINANCE';

export const ALL_INSIGHT_CATEGORIES: InsightCategory[] = [
    'SPIRITUEL', 'RELATIONS', 'MISSION', 'CREATIVITE',
    'EMOTIONS', 'TRAVAIL', 'SANTE', 'FINANCE',
];

export interface TestInsight {
    id: string;
    userId: string;
    orderId: string | null;
    category: InsightCategory;
    short: string;
    full: string;
    audioUrl: string | null;
    viewedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

let insightCounter = 0;

export function createTestInsight(overrides: Partial<TestInsight> = {}): TestInsight {
    insightCounter++;
    return {
        id: `insight-${insightCounter}`,
        userId: 'user-1',
        orderId: 'order-1',
        category: 'SPIRITUEL',
        short: 'Votre connexion spirituelle est profonde et lumineuse.',
        full: 'Votre âme rayonne d\'une lumière intérieure rare. La connexion au divin se manifeste à travers votre intuition aiguisée et vos synchronicités fréquentes.',
        audioUrl: null,
        viewedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

export function createTestInsights(userId: string, orderId?: string): TestInsight[] {
    return ALL_INSIGHT_CATEGORIES.map((category) =>
        createTestInsight({
            userId,
            orderId: orderId ?? null,
            category,
            short: `Résumé pour ${category.toLowerCase()}.`,
            full: `Analyse complète pour le domaine ${category.toLowerCase()}. Votre parcours révèle des forces significatives dans ce domaine.`,
        }),
    );
}

// =============================================================================
// SPIRITUAL PATH
// =============================================================================

export interface TestPathStep {
    id: string;
    spiritualPathId: string;
    dayNumber: number;
    title: string;
    description: string;
    synthesis: string;
    archetype: string;
    actionType: 'MANTRA' | 'RITUAL' | 'JOURNALING' | 'MEDITATION' | 'REFLECTION';
    ritualPrompt: string;
    isCompleted: boolean;
    completedAt: string | null;
    unlockedAt: string;
}

export interface TestSpiritualPath {
    id: string;
    userId: string;
    archetype: string;
    synthesis: string;
    keyBlockage: string;
    startedAt: string;
    completedAt: string | null;
    steps: TestPathStep[];
}

export function createTestSpiritualPath(userId: string, overrides: Partial<TestSpiritualPath> = {}): TestSpiritualPath {
    const pathId = `path-${Date.now()}`;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2); // Started 2 days ago

    const actionTypes: TestPathStep['actionType'][] = [
        'MEDITATION', 'MANTRA', 'JOURNALING', 'RITUAL', 'REFLECTION', 'MEDITATION', 'MANTRA',
    ];

    const steps: TestPathStep[] = Array.from({ length: 7 }, (_, i) => ({
        id: `step-${i + 1}`,
        spiritualPathId: pathId,
        dayNumber: i + 1,
        title: `Jour ${i + 1}: ${['Éveil', 'Ancrage', 'Ouverture', 'Transformation', 'Intégration', 'Rayonnement', 'Accomplissement'][i]}`,
        description: `Description de l'exercice du jour ${i + 1}.`,
        synthesis: `Synthèse de la leçon du jour ${i + 1}.`,
        archetype: 'Le Guérisseur',
        actionType: actionTypes[i],
        ritualPrompt: `Exercice spirituel pour le jour ${i + 1}.`,
        isCompleted: i < 2, // First 2 days completed
        completedAt: i < 2 ? new Date().toISOString() : null,
        unlockedAt: new Date(startDate.getTime() + i * 86400000).toISOString(),
    }));

    return {
        id: pathId,
        userId,
        archetype: 'Le Guérisseur',
        synthesis: 'Vous êtes un guérisseur naturel, porteur de lumière et de compassion.',
        keyBlockage: 'Peur de l\'abandon',
        startedAt: startDate.toISOString(),
        completedAt: null,
        steps,
        ...overrides,
    };
}

// =============================================================================
// SUBSCRIPTION
// =============================================================================

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'EXPIRED';

export interface TestSubscription {
    id: string;
    userId: string;
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    stripePriceId: string;
    status: SubscriptionStatus;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    cancelAtPeriodEnd: boolean;
    createdAt: string;
    updatedAt: string;
}

export function createTestSubscription(
    userId: string,
    status: SubscriptionStatus = 'ACTIVE',
    overrides: Partial<TestSubscription> = {},
): TestSubscription {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + 1);

    return {
        id: `sub-${Date.now()}`,
        userId,
        stripeSubscriptionId: `sub_test_${Date.now()}`,
        stripeCustomerId: `cus_test_${Date.now()}`,
        stripePriceId: 'price_test_29',
        status,
        currentPeriodStart: start.toISOString(),
        currentPeriodEnd: end.toISOString(),
        cancelAtPeriodEnd: false,
        createdAt: start.toISOString(),
        updatedAt: start.toISOString(),
        ...overrides,
    };
}

// =============================================================================
// DREAM
// =============================================================================

export interface TestDream {
    id: string;
    userId: string;
    content: string;
    emotion: string | null;
    interpretation: Record<string, unknown> | null;
    symbols: string[];
    linkedInsightId: string | null;
    linkedStepId: string | null;
    createdAt: string;
    updatedAt: string;
}

export function createTestDream(userId: string, overrides: Partial<TestDream> = {}): TestDream {
    return {
        id: `dream-${Date.now()}`,
        userId,
        content: 'Je marchais dans une forêt lumineuse, les arbres chantaient une mélodie ancienne.',
        emotion: 'paix',
        interpretation: {
            summary: 'Ce rêve symbolise un retour aux sources et une reconnexion avec la nature profonde de votre être.',
            symbols: ['forêt', 'lumière', 'musique'],
            guidance: 'Prenez le temps de vous reconnecter à la nature cette semaine.',
        },
        symbols: ['forêt', 'lumière', 'musique'],
        linkedInsightId: null,
        linkedStepId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}

// =============================================================================
// CHAT
// =============================================================================

export interface TestChatMessage {
    role: 'user' | 'assistant';
    content: string;
    createdAt: string;
}

export function createTestChatMessages(count: number = 4): TestChatMessage[] {
    const messages: TestChatMessage[] = [];
    for (let i = 0; i < count; i++) {
        messages.push({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: i % 2 === 0
                ? `Question spirituelle ${Math.ceil((i + 1) / 2)}`
                : `Chère âme, voici ma guidance pour votre question ${Math.ceil((i + 1) / 2)}.`,
            createdAt: new Date(Date.now() - (count - i) * 60000).toISOString(),
        });
    }
    return messages;
}

// =============================================================================
// ENTITLEMENTS
// =============================================================================

export interface TestEntitlements {
    capabilities: string[];
    products: string[];
    highestLevel: number;
    orderCount: number;
}

export function createTestEntitlements(subscribed: boolean = true): TestEntitlements {
    if (subscribed) {
        return {
            capabilities: ['content.basic', 'readings.pdf', 'chat_unlimited', 'dreams', 'spiritual_path', 'audio', 'insights'],
            products: ['subscription'],
            highestLevel: 4,
            orderCount: 1,
        };
    }
    return {
        capabilities: [],
        products: [],
        highestLevel: 0,
        orderCount: 0,
    };
}

// =============================================================================
// JWT TOKEN (mock)
// =============================================================================

export function createMockJwtPayload(user: TestUser, level: number = 4) {
    return {
        email: user.email,
        sub: user.id,
        userId: user.id,
        role: 'CLIENT',
        level,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30 days
    };
}
