// test-db.js
// Test de connexion Prisma -> PostgreSQL (ES Modules)

import prisma from './src/config/db.js';

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Connexion DB OK, résultat :', result);
  } catch (error) {
    console.error('❌ Erreur de connexion à la DB :', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

