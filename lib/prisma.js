import 'dotenv/config';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';

// Prisma 7 requiere un adapter de driver para conectar con PostgreSQL.
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
});

// Instancia unica compartida por controladores y arranque del servidor.
export const prisma = new PrismaClient({ adapter });
