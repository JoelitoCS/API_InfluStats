-- Añade la columna donations a metrics_youtube.
-- Ejecutar una sola vez en Supabase SQL Editor.
ALTER TABLE metrics_youtube
  ADD COLUMN IF NOT EXISTS donations DECIMAL(10, 2) NOT NULL DEFAULT 0;
