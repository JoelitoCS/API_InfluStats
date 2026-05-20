-- ─────────────────────────────────────────────────────────────────────────────
--  MIGRACIÓN: Añadir columna growth a metrics_history
--
--  Problema: el schema de Prisma define growth pero el CREATE TABLE original
--  en reset_metrics.sql no lo incluía, así que la columna no existe en Supabase.
--
--  Solución: ALTER TABLE para añadirla sin tocar datos existentes.
--
--  Ejecutar en: Supabase → SQL Editor → New Query → pegar y ejecutar.
-- ─────────────────────────────────────────────────────────────────────────────

-- Añade la columna growth como NUMERIC(8,2) nullable.
-- NULL significa que es el primer registro del perfil (sin semana anterior con
-- la que comparar). Coincide exactamente con @db.Decimal(8, 2) del schema Prisma.
ALTER TABLE public.metrics_history
  ADD COLUMN IF NOT EXISTS growth NUMERIC(8, 2) DEFAULT NULL;

-- Verificación: muestra la estructura actualizada de la tabla.
-- Puedes comentar esta línea si el editor no soporta SELECT tras ALTER.
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'metrics_history'
ORDER BY ordinal_position;
