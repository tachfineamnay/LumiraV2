import { PrismaClient, ProductLevel, ExpertRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ========================================
// CONFIGURATION
// ========================================
const SALT_ROUNDS = 12;
const ADMIN_PASSWORD = 'AdminLumira2025!';
const CLIENT_PASSWORD = 'ClientLumira2025!';

async function main() {
    console.log('');
    console.log('🌟 ══════════════════════════════════════════════════════════');
    console.log('   ORACLE LUMIRA V2 - DATABASE SEEDING');
    console.log('   ══════════════════════════════════════════════════════════');
    console.log('');

    // ========================================
    // 1. EXPERTS (Admin & Expert)
    // ========================================
    console.log('👤 Creating experts...');

    const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

    // Admin expert
    const admin = await prisma.expert.upsert({
        where: { email: 'admin@oraclelumira.com' },
        update: {
            password: adminPasswordHash,
            name: 'Master Lumira',
            role: ExpertRole.ADMIN,
            isActive: true,
        },
        create: {
            email: 'admin@oraclelumira.com',
            password: adminPasswordHash,
            name: 'Master Lumira',
            role: ExpertRole.ADMIN,
            isActive: true,
        },
    });
    console.log(`   ✅ Admin: ${admin.email} (Master Lumira)`);

    // Expert user
    const expert = await prisma.expert.upsert({
        where: { email: 'expert@oraclelumira.com' },
        update: {
            password: adminPasswordHash,
            name: 'Amine Expert',
            role: ExpertRole.EXPERT,
            isActive: true,
        },
        create: {
            email: 'expert@oraclelumira.com',
            password: adminPasswordHash,
            name: 'Amine Expert',
            role: ExpertRole.EXPERT,
            isActive: true,
        },
    });
    console.log(`   ✅ Expert: ${expert.email} (Amine Expert)`);

    // ========================================
    // 2. PRODUCTS
    // ========================================
    console.log('');
    console.log('📦 Creating products...');

    const products = [
        {
            id: 'initie',
            level: ProductLevel.INITIE,
            name: 'Initié',
            description: 'Analyse de base de votre thème astral.',
            amountCents: 4900, // 49€
            features: [
                'Thème astral de base',
                'Interprétation personnalisée',
                'PDF 4 pages',
            ],
            isActive: true,
        },
        {
            id: 'mystique',
            level: ProductLevel.MYSTIQUE,
            name: 'Mystique',
            description: 'Plongée profonde dans vos alignements stellaires.',
            amountCents: 9900, // 99€
            features: [
                'Analyse des alignements stellaires',
                'Profil de l\'âme complet',
                'Audio 10 minutes',
                'PDF 8 pages détaillé',
            ],
            isActive: true,
        },
        {
            id: 'profond',
            level: ProductLevel.PROFOND,
            name: 'Profond',
            description: 'Rapport complet incluant les transits planétaires annuels.',
            amountCents: 14900, // 149€
            features: [
                'Transits planétaires annuels',
                'Analyse des blocages énergétiques',
                'Méditation guidée audio 20 minutes',
                'PDF 12 pages avec prévisions',
            ],
            isActive: true,
        },
        {
            id: 'integrale',
            level: ProductLevel.INTEGRALE,
            name: 'Intégrale',
            description: 'L\'expérience Lumira totale : Destinée, Karma et Guidance.',
            amountCents: 19900, // 199€
            features: [
                'Cartographie complète du chemin de vie',
                'Analyse karmique approfondie',
                'Guidance personnalisée',
                'Mandala personnel HD',
                'Audio complet 30 minutes',
                'PDF 20 pages + Mandala à imprimer',
            ],
            isActive: true,
        },
    ];

    for (const product of products) {
        await prisma.product.upsert({
            where: { id: product.id },
            update: product,
            create: product,
        });
        console.log(`   ✅ ${product.name} - ${product.amountCents / 100}€`);
    }

    // ========================================
    // 3. TEST CLIENT (User & UserProfile)
    // ========================================
    console.log('');
    console.log('🧪 Creating test client...');

    const clientPasswordHash = await bcrypt.hash(CLIENT_PASSWORD, SALT_ROUNDS);

    // Create or update test user
    const testUser = await prisma.user.upsert({
        where: { email: 'client@test.com' },
        update: {
            firstName: 'Test',
            lastName: 'Client',
            phone: '+33612345678',
            dateOfBirth: new Date('1990-05-15'),
        },
        create: {
            email: 'client@test.com',
            firstName: 'Test',
            lastName: 'Client',
            phone: '+33612345678',
            dateOfBirth: new Date('1990-05-15'),
        },
    });
    console.log(`   ✅ User: ${testUser.email} (${testUser.firstName} ${testUser.lastName})`);

    // Create or update user profile
    await prisma.userProfile.upsert({
        where: { userId: testUser.id },
        update: {
            birthDate: '1990-05-15',
            birthTime: '14:30',
            birthPlace: 'Paris',
            profileCompleted: true,
            submittedAt: new Date(),
        },
        create: {
            userId: testUser.id,
            birthDate: '1990-05-15',
            birthTime: '14:30',
            birthPlace: 'Paris',
            profileCompleted: true,
            submittedAt: new Date(),
        },
    });
    console.log(`   ✅ UserProfile: Paris, 1990-05-15 à 14:30`);

    // ========================================
    // 4. SUMMARY
    // ========================================
    const productCount = await prisma.product.count();
    const expertCount = await prisma.expert.count();
    const userCount = await prisma.user.count();
    const profileCount = await prisma.userProfile.count();

    console.log('');
    console.log('🎉 ══════════════════════════════════════════════════════════');
    console.log('   SEED COMPLETED SUCCESSFULLY!');
    console.log('   ══════════════════════════════════════════════════════════');
    console.log('');
    console.log('   📊 Database Statistics:');
    console.log(`      📦 Products:     ${productCount}`);
    console.log(`      👤 Experts:      ${expertCount}`);
    console.log(`      🧑 Users:        ${userCount}`);
    console.log(`      📋 Profiles:     ${profileCount}`);
    console.log('');
    console.log('   🔐 Login Credentials:');
    console.log('');
    console.log('      ADMIN:');
    console.log('      └─ Email:    admin@oraclelumira.com');
    console.log('      └─ Password: AdminLumira2025!');
    console.log('');
    console.log('      EXPERT:');
    console.log('      └─ Email:    expert@oraclelumira.com');
    console.log('      └─ Password: AdminLumira2025!');
    console.log('');
    console.log('      TEST CLIENT:');
    console.log('      └─ Email:    client@test.com');
    console.log('      └─ Password: ClientLumira2025!');
    console.log('');
    console.log('══════════════════════════════════════════════════════════════');
    console.log('');
}

main()
    .catch((e) => {
        console.error('');
        console.error('❌ ══════════════════════════════════════════════════════════');
        console.error('   SEED ERROR');
        console.error('   ══════════════════════════════════════════════════════════');
        console.error('');
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
