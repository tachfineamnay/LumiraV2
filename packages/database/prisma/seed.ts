import { PrismaClient, ProductLevel, ExpertRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // ========================================
    // 1. PRODUITS
    // ========================================
    console.log('📦 Creating products...');

    const products = [
        {
            id: 'initie',
            level: ProductLevel.INITIE,
            name: 'Initié',
            description: 'Découverte de votre chemin spirituel',
            amountCents: 0,
            features: [
                'Tirage 1 carte oracle',
                'Interprétation personnalisée',
                'PDF 2 pages'
            ],
            isActive: true,
        },
        {
            id: 'mystique',
            level: ProductLevel.MYSTIQUE,
            name: 'Mystique',
            description: "Exploration de votre profil d'âme",
            amountCents: 4700, // centimes (47€)
            features: [
                "Profil de l'âme complet",
                'Dons et talents naturels',
                'Audio 5 minutes',
                'PDF 4 pages détaillé'
            ],
            isActive: true,
        },
        {
            id: 'profond',
            level: ProductLevel.PROFOND,
            name: 'Profond',
            description: 'Transformation et libération des blocages',
            amountCents: 6700, // centimes (67€)
            features: [
                'Analyse des blocages énergétiques',
                'Rituel de transformation personnalisé',
                'Méditation guidée audio 12 minutes',
                'PDF 6-8 pages avec rituel'
            ],
            isActive: true,
        },
        {
            id: 'integrale',
            level: ProductLevel.INTEGRALE,
            name: 'Intégrale',
            description: 'Cartographie complète de votre chemin de vie',
            amountCents: 9700, // centimes (97€)
            features: [
                'Cartographie complète du chemin de vie',
                'Mandala personnel HD',
                'Analyse des cycles et transitions',
                'Audio complet 25 minutes',
                'PDF 15 pages + Mandala à imprimer'
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
        console.log(`  ✅ Product ${product.name} created/updated`);
    }

    // ========================================
    // 2. EXPERT ADMIN
    // ========================================
    console.log('👤 Creating expert admin...');

    const hashedPassword = await bcrypt.hash('mdp123', 12);

    await prisma.expert.upsert({
        where: { email: 'expert@oraclelumira.com' },
        update: {
            password: hashedPassword,
            name: 'Oracle Expert',
            role: ExpertRole.ADMIN,
            isActive: true,
        },
        create: {
            email: 'expert@oraclelumira.com',
            password: hashedPassword,
            name: 'Oracle Expert',
            role: ExpertRole.ADMIN,
            isActive: true,
        },
    });
    console.log('  ✅ Expert admin created/updated');

    // ========================================
    // 3. RÉSUMÉ
    // ========================================
    const productCount = await prisma.product.count();
    const expertCount = await prisma.expert.count();

    console.log('');
    console.log('🎉 Seed completed!');
    console.log(`   📦 Products: ${productCount}`);
    console.log(`   👤 Experts: ${expertCount}`);
    console.log('');
    console.log('🔐 Expert login:');
    console.log('   Email: expert@oraclelumira.com');
    console.log('   Password: mdp123');
}

main()
    .catch((e) => {
        console.error('❌ Seed error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
