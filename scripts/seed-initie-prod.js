/**
 * Oracle Lumira - Production Seed Script
 * 
 * Script JavaScript pur (CommonJS) pour initialiser/mettre à jour
 * le produit "Initié" à 9€ et désactiver les autres.
 * 
 * Exécution: node /app/scripts/seed-initie-prod.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('');
    console.log('🌟 ══════════════════════════════════════════════════════════');
    console.log('   ORACLE LUMIRA - PRODUCTION SEED');
    console.log('   ══════════════════════════════════════════════════════════');
    console.log('');

    // 1. Upsert du produit Initié à 9€
    console.log('📦 Mise à jour du produit Initié...');

    const initie = await prisma.product.upsert({
        where: { id: 'initie' },
        update: {
            name: 'Initié',
            description: 'Accès Master - Offre Unique',
            amountCents: 900, // 9 EUR
            features: [
                'Accès complet au Sanctuaire',
                'Lectures audio & PDF',
                'Mandala HD personnalisé',
                'Rituels sacrés',
                'Analyses karmiques & missions'
            ],
            isActive: true,
        },
        create: {
            id: 'initie',
            name: 'Initié',
            description: 'Accès Master - Offre Unique',
            amountCents: 900,
            level: 'INITIE',
            features: [
                'Accès complet au Sanctuaire',
                'Lectures audio & PDF',
                'Mandala HD personnalisé',
                'Rituels sacrés',
                'Analyses karmiques & missions'
            ],
            isActive: true,
        },
    });

    console.log(`   ✅ Initié: ${initie.amountCents / 100}€ (Active: ${initie.isActive})`);

    // 2. Désactiver tous les autres produits
    console.log('');
    console.log('🔒 Désactivation des autres produits...');

    const result = await prisma.product.updateMany({
        where: {
            id: { not: 'initie' }
        },
        data: {
            isActive: false,
        },
    });

    console.log(`   ✅ ${result.count} produit(s) désactivé(s)`);

    // 3. Afficher le résumé
    console.log('');
    console.log('📊 État final des produits:');

    const allProducts = await prisma.product.findMany({
        select: { id: true, name: true, amountCents: true, isActive: true },
        orderBy: { id: 'asc' },
    });

    for (const p of allProducts) {
        const status = p.isActive ? '🟢 Actif' : '⚪ Inactif';
        console.log(`   ${status} | ${p.name.padEnd(12)} | ${(p.amountCents / 100).toFixed(2)}€`);
    }

    console.log('');
    console.log('🎉 ══════════════════════════════════════════════════════════');
    console.log('   SEED TERMINÉ AVEC SUCCÈS!');
    console.log('   ══════════════════════════════════════════════════════════');
    console.log('');
}

main()
    .catch((e) => {
        console.error('');
        console.error('❌ ERREUR SEED:', e.message);
        console.error('');
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
