// ─────────────────────────────────────────────────────────────────────────────
//  lib/prisma.js — Instancia única compartida de PrismaClient
//
//  Por qué existe este archivo:
//    Prisma recomienda crear UNA SOLA instancia del cliente en toda la app.
//    Si cada controlador crease su propio PrismaClient se agotaría el pool
//    de conexiones a la base de datos y habría errores de "too many clients".
//
//  Por qué usamos un adapter (PrismaPg):
//    Prisma 7 requiere un "driver adapter" para conectarse a PostgreSQL.
//    PrismaPg es el adapter oficial que usa el paquete 'pg' (node-postgres)
//    bajo el capó. Sin él, Prisma no sabría cómo hablar con la BD.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'; // Carga .env antes de leer process.env
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

// PrismaPg: adapter que conecta Prisma 7 con PostgreSQL a través de 'pg'
import { PrismaPg } from '@prisma/adapter-pg';

// Leemos la cadena de conexión del archivo .env
// Formato: postgresql://usuario:password@host:puerto/base_de_datos
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL
});

// Exportamos la instancia única. Todos los controladores importan este objeto
// en lugar de crear uno propio: import { prisma } from '../lib/prisma.js'
export const prisma = new PrismaClient({ adapter });
