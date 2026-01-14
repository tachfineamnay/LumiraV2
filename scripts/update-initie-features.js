/**
 * Update Initié Product Features for MVP
 * 
 * This script updates the "Initié" product (9€) with the full feature set
 * for the Oracle Lumira MVP experience.
 * 
 * Run with: node scripts/update-initie-features.js
 */

const { PrismaClient, ProductLevel } = require('@prisma/client');

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
    console.log('🔮 Oracle Lumira - MVP Configuration\n');
    console.log('=====================================\n');

    // Step 1: Upsert the Initié product with correct enum value
    console.log('📦 Configuring Initié product...');

    const initieProduct = await prisma.product.upsert({
        where: { id: 'initie' },
        update: {
            name: 'Initié',
            description: 'Votre première initiation spirituelle complète avec lecture PDF, timeline 7 jours, et accès au chat Oracle.',
            amountCents: 900,
            features: MVP_FEATURES,
            isActive: true,
        },
        create: {
            id: 'initie',
            level: ProductLevel.INITIE,
            name: 'Initié',
            description: 'Votre première initiation spirituelle complète avec lecture PDF, timeline 7 jours, et accès au chat Oracle.',
            amountCents: 900,
            features: MVP_FEATURES,
            isActive: true,
        },
    });

    console.log('   ✅ ID:', initieProduct.id);
    console.log('   ✅ Name:', initieProduct.name);
    console.log('   ✅ Price:', initieProduct.amountCents / 100, '€');
    console.log('   ✅ Active:', initieProduct.isActive);
    console.log('   ✅ Features:', MVP_FEATURES.length, 'features configured');

    // Step 2: Deactivate all other products (MVP strategy)
    console.log('\n🚫 Deactivating other products for MVP...');

    const deactivated = await prisma.product.updateMany({
        where: {
            id: { not: 'initie' },
        },
        data: {
            isActive: false,
        },
    });

    console.log('   ✅ Deactivated', deactivated.count, 'other products');

    // Step 3: Summary
    console.log('\n=====================================');
    console.log('✨ MVP Configuration Complete!\n');
    console.log('Active Products:');

    const activeProducts = await prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, amountCents: true, features: true },
    });

    for (const product of activeProducts) {
        console.log(`   - ${product.name} (${product.amountCents / 100}€)`);
        if (Array.isArray(product.features)) {
            product.features.slice(0, 3).forEach(f => console.log(`     • ${f}`));
            if (product.features.length > 3) {
                console.log(`     ... and ${product.features.length - 3} more`);
            }
        }
    }

    console.log('\n🎉 Done!');
}

main()
    .catch((e) => {
        console.error('\n❌ Error:', e.message);
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
