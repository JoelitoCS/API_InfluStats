/**
 * seed-admin.js
 * Ejecutar UNA sola vez: node seed-admin.js
 *
 * 1. Añade la columna `role` a la tabla `users` si no existe
 * 2. Crea el usuario admin@admin.com / admin123 con role='admin'
 *    (o solo le pone role='admin' si ya existe)
 */

import bcrypt from 'bcryptjs';
import { prisma } from './lib/prisma.js';

const ADMIN_EMAIL    = 'admin@admin.com';
const ADMIN_PASSWORD = 'Admin123';   // cumple: mayúscula + minúscula + número

async function main() {
  // ── 1. Añadir columna role si no existe (idempotente) ──────────────────────
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
    `);
    console.log('✓ Columna role asegurada en tabla users');
  } catch (err) {
    console.error('✗ Error al añadir columna role:', err.message);
    process.exit(1);
  }

  // ── 2. Crear o actualizar el usuario admin ─────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    // Ya existe → solo actualizar role y contraseña por si acaso
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(ADMIN_PASSWORD, salt);
    await prisma.user.update({
      where: { email: ADMIN_EMAIL },
      data:  { role: 'admin', passwordHash: hash },
    });
    console.log(`✓ Usuario ${ADMIN_EMAIL} actualizado a role='admin'`);
  } else {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(ADMIN_PASSWORD, salt);
    await prisma.user.create({
      data: {
        email:        ADMIN_EMAIL,
        passwordHash: hash,
        name:         'Admin',
        role:         'admin',
      },
    });
    console.log(`✓ Usuario ${ADMIN_EMAIL} creado con role='admin'`);
  }

  console.log('\n✅ Seed completado. Credenciales:');
  console.log(`   Email:     ${ADMIN_EMAIL}`);
  console.log(`   Password:  ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
