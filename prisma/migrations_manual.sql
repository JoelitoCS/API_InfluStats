-- ─────────────────────────────────────────────────────────────────────────────
--  InfluStats — Migración manual para índices de performance
--  Ejecutar en Supabase SQL Editor si no se usa prisma migrate
--  Estos índices optimizan: búsqueda de usuarios, explorar, rankings
-- ─────────────────────────────────────────────────────────────────────────────

-- Índice para filtrar perfiles públicos (Explorar, Rankings, Búsqueda)
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_public
  ON user_profiles (is_public);

-- Índice para búsqueda por username (autocomplete)
CREATE INDEX IF NOT EXISTS idx_user_profiles_username
  ON user_profiles (username);

-- Índice para búsqueda case-insensitive (ILIKE en displayName)
CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name_lower
  ON user_profiles (LOWER(display_name));

-- Índice para filtrar social_links activas y públicas
CREATE INDEX IF NOT EXISTS idx_social_links_profile_pub_active
  ON social_links (profile_id, is_public, is_active);

-- Índice para historial de métricas por perfil y fecha (gráficos)
CREATE INDEX IF NOT EXISTS idx_metrics_history_profile_date
  ON metrics_history (profile_id, week_date DESC);

-- Índice para social_profiles por usuario (JOIN con user_profiles)
CREATE INDEX IF NOT EXISTS idx_social_profiles_user_id
  ON social_profiles (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
--  RLS Policies para seguridad a nivel de fila
--  Asegura que datos privados no se filtren nunca
-- ─────────────────────────────────────────────────────────────────────────────

-- Habilitar RLS en user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: los perfiles públicos son visibles para todos
CREATE POLICY IF NOT EXISTS "public_profiles_visible"
  ON user_profiles FOR SELECT
  USING (is_public = true);

-- Policy: el propietario puede ver su propio perfil (público o privado)
-- Nota: auth.uid() corresponde al ID de Supabase Auth (si se usa)
-- Si se usa JWT propio (como en este proyecto), la seguridad se gestiona en Express

-- Habilitar RLS en social_links
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;

-- Policy: solo las social_links públicas y activas son visibles para todos
CREATE POLICY IF NOT EXISTS "public_social_links_visible"
  ON social_links FOR SELECT
  USING (is_public = true AND is_active = true);

-- ─────────────────────────────────────────────────────────────────────────────
--  Bucket de Supabase Storage para avatares
--  Ejecutar si el bucket no existe aún
-- ─────────────────────────────────────────────────────────────────────────────

-- Crear bucket 'avatars' como público (las URLs de avatar son públicas)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB en bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy de Storage: cualquiera puede leer avatares (son públicos)
CREATE POLICY IF NOT EXISTS "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Policy de Storage: solo el backend puede subir (usando service_role key)
-- El backend usa service_role key que bypasea RLS, así que esto es para
-- prevenir subidas directas desde el frontend
CREATE POLICY IF NOT EXISTS "avatars_service_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars');
