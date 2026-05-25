/**
 * migrate-needs-update.js
 * Ejecutar UNA sola vez: node migrate-needs-update.js
 *
 * Añade la columna needs_update a social_profiles y regenera el cliente Prisma.
 */

import { prisma } from './lib/prisma.js';

async function main() {
  // 1. Añadir columna si no existe
  await prisma.$executeRawUnsafe(`
    ALTER TABLE social_profiles
    ADD COLUMN IF NOT EXISTS needs_update BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log('✓ Columna needs_update añadida a social_profiles');

  // 2. Marcar inmediatamente los perfiles ya obsoletos (> 7 días sin métricas)
  const result = await prisma.$executeRawUnsafe(`
    UPDATE social_profiles sp
    SET needs_update = true
    WHERE NOT EXISTS (
      SELECT 1 FROM metrics_history mh
      WHERE mh.profile_id = sp.id
        AND mh.week_date >= NOW() - INTERVAL '7 days'
    );
  `);
  console.log(`✓ Perfiles marcados como needs_update = true: ${result}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
