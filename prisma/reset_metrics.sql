-- ─────────────────────────────────────────────────────────────────────────────
--  REESTRUCTURACIÓN DE MÉTRICAS — Opción B: tabla base + tablas por plataforma
--  Ejecutar en Supabase SQL Editor de una sola vez.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Eliminamos la tabla monolítica anterior (sin datos que conservar)
DROP TABLE IF EXISTS public.metrics_youtube   CASCADE;
DROP TABLE IF EXISTS public.metrics_tiktok    CASCADE;
DROP TABLE IF EXISTS public.metrics_twitch    CASCADE;
DROP TABLE IF EXISTS public.metrics_instagram CASCADE;
DROP TABLE IF EXISTS public.metrics_history   CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
--  2. Tabla base: campos comunes a todas las plataformas.
--     Cada fila representa una semana de datos para un perfil concreto.
--     El engagement se calcula en el backend y se guarda aquí.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.metrics_history (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID         NOT NULL REFERENCES public.social_profiles(id) ON DELETE CASCADE,
  week_date   DATE         NOT NULL,
  engagement  NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- Crecimiento % respecto a la semana anterior. NULL = primer registro del perfil.
  growth      NUMERIC(8,2) DEFAULT NULL,
  created_at  TIMESTAMPTZ  DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
--  3. Tabla de métricas de YouTube.
--     Se relaciona 1:1 con metrics_history mediante metrics_id.
--     Campos: visitas, likes, suscriptores y miembros de pago.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.metrics_youtube (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  metrics_id  UUID    NOT NULL UNIQUE REFERENCES public.metrics_history(id) ON DELETE CASCADE,
  views       INTEGER NOT NULL DEFAULT 0,  -- visitas totales de la semana
  likes       INTEGER NOT NULL DEFAULT 0,  -- likes recibidos
  subscribers INTEGER NOT NULL DEFAULT 0,  -- suscriptores totales al final de la semana
  paid_members INTEGER NOT NULL DEFAULT 0  -- miembros con membresía de pago
);

-- ─────────────────────────────────────────────────────────────────────────────
--  4. Tabla de métricas de TikTok.
--     Campos: visitas, likes, comentarios, favoritos, compartidos y seguidores.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.metrics_tiktok (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  metrics_id  UUID    NOT NULL UNIQUE REFERENCES public.metrics_history(id) ON DELETE CASCADE,
  views       INTEGER NOT NULL DEFAULT 0,  -- visualizaciones totales
  likes       INTEGER NOT NULL DEFAULT 0,  -- likes recibidos
  comments    INTEGER NOT NULL DEFAULT 0,  -- comentarios recibidos
  favorites   INTEGER NOT NULL DEFAULT 0,  -- veces marcado como favorito
  shares      INTEGER NOT NULL DEFAULT 0,  -- veces compartido
  followers   INTEGER NOT NULL DEFAULT 0   -- seguidores al final de la semana
);

-- ─────────────────────────────────────────────────────────────────────────────
--  5. Tabla de métricas de Twitch.
--     Campos: visualizaciones, seguidores, suscriptores (Prime+pago) y bits.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.metrics_twitch (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  metrics_id         UUID    NOT NULL UNIQUE REFERENCES public.metrics_history(id) ON DELETE CASCADE,
  views              INTEGER NOT NULL DEFAULT 0,  -- visualizaciones totales del stream
  followers          INTEGER NOT NULL DEFAULT 0,  -- seguidores totales del canal
  subscribers_twitch INTEGER NOT NULL DEFAULT 0,  -- suscriptores Prime + pago unificados
  bits               INTEGER NOT NULL DEFAULT 0   -- bits donados durante la semana
);

-- ─────────────────────────────────────────────────────────────────────────────
--  6. Tabla de métricas de Instagram.
--     Campos: visualizaciones, likes, guardados, seguidores y publicaciones.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.metrics_instagram (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  metrics_id  UUID    NOT NULL UNIQUE REFERENCES public.metrics_history(id) ON DELETE CASCADE,
  views       INTEGER NOT NULL DEFAULT 0,  -- visualizaciones totales
  likes       INTEGER NOT NULL DEFAULT 0,  -- likes recibidos
  favorites   INTEGER NOT NULL DEFAULT 0,  -- publicaciones guardadas
  followers   INTEGER NOT NULL DEFAULT 0,  -- seguidores al final de la semana
  posts       INTEGER NOT NULL DEFAULT 0   -- publicaciones realizadas esa semana
);
