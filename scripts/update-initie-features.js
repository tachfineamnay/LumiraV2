/**
 * Update Initié Product Features for MVP
 * 
 * This script updates the "Initié" product (9€) with the full feature set
 * for the Oracle Lumira MVP experience.
 * 
 * Run with: node scripts/update-initie-features.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const MVP_FEATURES = [
    'full_reading_pdf',
    '7_day_timeline',
    'oracle_chat_access',
    'synthesis_dashboard',
    'daily_mantra',
    'archetype_reveal',
];

async function main() {
    console.log('🔮 Updating Initié product features...\n');

    // Find the Initié product (level 1, 900 cents = 9€)
    const initieProduct = await prisma.product.findFirst({
        where: {
            OR: [
                { level: 1 },
                { amountCents: 900 },
                { name: { contains: 'Initié', mode: 'insensitive' } },
            ],
        },
    });

    if (!initieProduct) {
        console.log('❌ Initié product not found. Creating...');

        const newProduct = await prisma.product.create({
            data: {
                level: 1,
                name: 'Initié',
                description: 'Votre première initiation spirituelle complète avec lecture PDF, timeline 7 jours, et accès au chat Oracle.',
                amountCents: 900,
                features: MVP_FEATURES,
                isActive: true,
            },
        });

        console.log('✅ Created Initié product:', newProduct.id);
        console.log('   Features:', MVP_FEATURES.join(', '));
        return;
    }

    // Update existing product
    const updated = await prisma.product.update({
        where: { id: initieProduct.id },
        data: {
            features: MVP_FEATURES,
            isActive: true,
            description: 'Votre première initiation spirituelle complète avec lecture PDF, timeline 7 jours, et accès au chat Oracle.',
        },
    });

    console.log('✅ Updated Initié product:', updated.id);
    console.log('   Name:', updated.name);
    console.log('   Price:', updated.amountCents / 100, '€');
    console.log('   Features:', MVP_FEATURES.join(', '));
    console.log('   Active:', updated.isActive);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
