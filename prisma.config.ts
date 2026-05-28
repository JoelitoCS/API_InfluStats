// Configuracion de Prisma CLI — Prisma 7
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // DIRECT_URL = conexión directa puerto 5432 (sin pgbouncer)
    // Necesaria para db push / migrate / studio
    url: process.env["DIRECT_URL"],
  },
});
