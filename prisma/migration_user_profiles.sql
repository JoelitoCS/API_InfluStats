-- ═══════════════════════════════════════════════════════════════════════════
--  InfluStats — Migración: Sistema de perfiles de usuario
--  Pegar y ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── user_profiles ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  bio           TEXT,
  short_bio     TEXT,
  avatar_url    TEXT,
  avatar_path   TEXT,
  country       TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles (username);
CREATE INDEX IF NOT EXISTS idx_user_profiles_search
  ON user_profiles USING gin(to_tsvector('simple', username || ' ' || coalesce(display_name, '')));

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── social_links ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  platform    TEXT NOT NULL CHECK (platform IN (
                'instagram','tiktok','twitter','youtube','twitch',
                'discord','github','linkedin','website'
              )),
  url         TEXT NOT NULL,
  label       TEXT,
  is_public   BOOLEAN NOT NULL DEFAULT true,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, platform)
);

DROP TRIGGER IF EXISTS update_social_links_updated_at ON social_links;
CREATE TRIGGER update_social_links_updated_at
  BEFORE UPDATE ON social_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Perfiles publicos visibles" ON user_profiles;
CREATE POLICY "Perfiles publicos visibles"
  ON user_profiles FOR SELECT USING (is_public = true);
