// ─────────────────────────────────────────────────────────────────────────────
//  controller/userProfileController.js — Sistema de perfiles de usuario
// ─────────────────────────────────────────────────────────────────────────────

import { prisma }                          from '../lib/prisma.js';
import { uploadAvatar, deleteAvatar }      from '../lib/supabaseStorage.js';
import fs                                  from 'fs';
import path                                from 'path';
import { v4 as uuidv4 }                   from 'uuid';

const VALID_SOCIAL_PLATFORMS = new Set([
  'instagram', 'tiktok', 'twitter', 'youtube', 'twitch',
  'discord', 'github', 'linkedin', 'website',
]);

// ── buildStats ────────────────────────────────────────────────────────────────
// Agrega métricas de cada perfil social incluyendo historial para gráficos.
async function buildStats(socialProfiles) {
  const stats = [];

  for (const sp of socialProfiles) {
    // Obtener historial de las últimas 12 semanas para gráficos
    const history = await prisma.metricsHistory.findMany({
      where:   { profileId: sp.id },
      orderBy: { weekDate: 'asc' },
      take:    12,
      include: { youtube: true, tiktok: true, twitch: true, instagram: true },
    });

    if (!history.length) continue;

    const last   = history[history.length - 1];
    const detail = last.youtube || last.tiktok || last.twitch || last.instagram || {};

    const historyFormatted = history.map((h) => {
      const d = h.youtube || h.tiktok || h.twitch || h.instagram || {};
      return {
        weekDate:   h.weekDate,
        followers:  d.followers ?? d.subscribers ?? 0,
        views:      d.views ?? 0,
        engagement: Number(h.engagement ?? 0),
        growth:     h.growth !== null ? Number(h.growth) : null,
      };
    });

    stats.push({
      platform:   sp.platform,
      username:   sp.username,
      followers:  detail.followers ?? detail.subscribers ?? 0,
      views:      detail.views ?? 0,
      engagement: Number(last.engagement ?? 0).toFixed(2),
      growth:     last.growth !== null ? Number(last.growth).toFixed(2) : null,
      weekDate:   last.weekDate,
      history:    historyFormatted,
    });
  }

  return stats;
}

// ── formatPublicProfile ───────────────────────────────────────────────────────
function formatPublicProfile(profile, stats = []) {
  return {
    id:          profile.id,
    username:    profile.username,
    displayName: profile.displayName,
    shortBio:    profile.shortBio,
    bio:         profile.bio,
    avatarUrl:   profile.avatarUrl,
    country:     profile.country,
    isPublic:    profile.isPublic,
    createdAt:   profile.createdAt,
    socialLinks: (profile.socialLinks || [])
      .filter((l) => l.isPublic && l.isActive)
      .map(({ id, platform, url, label }) => ({ id, platform, url, label })),
    stats,
  };
}

// ── getRankPosition ───────────────────────────────────────────────────────────
async function getRankPosition(userId) {
  try {
    const userProfiles = await prisma.socialProfile.findMany({
      where:  { userId },
      select: {
        metrics: { orderBy: { weekDate: 'desc' }, take: 1, select: { engagement: true } },
      },
    });

    const engagements = userProfiles
      .map((p) => p.metrics[0]?.engagement)
      .filter(Boolean)
      .map(Number);

    if (!engagements.length) return null;
    const avg = engagements.reduce((a, b) => a + b, 0) / engagements.length;

    const ahead = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT sp.user_id)::int AS cnt
      FROM social_profiles sp
      JOIN metrics_history mh ON mh.profile_id = sp.id
      JOIN user_profiles up   ON up.user_id = sp.user_id
      WHERE up.is_public = true
        AND sp.user_id != ${userId}::uuid
        AND mh.engagement > ${avg}::numeric
    `;

    return (ahead[0]?.cnt ?? 0) + 1;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  getMyProfile — GET /api/user-profile/me
// ═══════════════════════════════════════════════════════════════════════════════
export const getMyProfile = async (req, res) => {
  try {
    const profile = await prisma.userProfile.findUnique({
      where:   { userId: req.user.id },
      include: { socialLinks: { orderBy: { platform: 'asc' } } },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado. Créalo primero.' });
    }

    return res.json({ success: true, profile });
  } catch (err) {
    console.error('getMyProfile:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener perfil', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  upsertMyProfile — PUT /api/user-profile/me
// ═══════════════════════════════════════════════════════════════════════════════
export const upsertMyProfile = async (req, res) => {
  try {
    const { username, displayName, bio, shortBio, country, isPublic } = req.body;

    if (username) {
      const clean = String(username).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(clean)) {
        return res.status(400).json({
          success: false,
          message: 'Username inválido. Solo letras, números, puntos y guiones. 3-30 caracteres.',
        });
      }
      const existing = await prisma.userProfile.findUnique({ where: { username: clean } });
      if (existing && existing.userId !== req.user.id) {
        return res.status(409).json({ success: false, message: 'Ese username ya está en uso.' });
      }
    }

    const data = {};
    if (username    !== undefined) data.username    = String(username).trim().toLowerCase();
    if (displayName !== undefined) data.displayName = String(displayName).trim();
    if (bio         !== undefined) data.bio         = String(bio).trim();
    if (shortBio    !== undefined) data.shortBio    = String(shortBio).trim();
    if (country     !== undefined) data.country     = String(country).trim();
    if (isPublic    !== undefined) data.isPublic    = Boolean(isPublic);

    const profile = await prisma.userProfile.upsert({
      where:   { userId: req.user.id },
      create:  { ...data, userId: req.user.id, username: data.username || `user_${req.user.id.slice(0, 8)}` },
      update:  data,
      include: { socialLinks: true },
    });

    return res.json({ success: true, message: 'Perfil actualizado correctamente.', profile });
  } catch (err) {
    console.error('upsertMyProfile:', err);
    return res.status(500).json({ success: false, message: 'Error al guardar perfil', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  uploadMyAvatar — POST /api/user-profile/me/avatar
// ═══════════════════════════════════════════════════════════════════════════════
export const uploadMyAvatar = async (req, res) => {
  let tempPath = null;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se recibió ningún archivo.' });
    }

    tempPath     = req.file.path;
    const ext    = path.extname(req.file.originalname).toLowerCase() || '.jpg';
    const storagePath = `${req.user.id}/avatar${ext}`;

    const { publicUrl } = await uploadAvatar(tempPath, storagePath, req.file.mimetype);

    const profile = await prisma.userProfile.upsert({
      where:   { userId: req.user.id },
      create:  { userId: req.user.id, username: `user_${req.user.id.slice(0, 8)}`, avatarUrl: publicUrl, avatarPath: storagePath },
      update:  { avatarUrl: publicUrl, avatarPath: storagePath },
    });

    return res.json({ success: true, message: 'Avatar actualizado.', avatarUrl: profile.avatarUrl });
  } catch (err) {
    console.error('uploadMyAvatar:', err);
    return res.status(500).json({ success: false, message: 'Error al subir avatar', error: err.message });
  } finally {
    if (tempPath) { try { fs.unlinkSync(tempPath); } catch {} }
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  getPublicProfile — GET /api/user-profile/:username
//  Incluye historial de métricas para gráficos
// ═══════════════════════════════════════════════════════════════════════════════
export const getPublicProfile = async (req, res) => {
  try {
    const { username } = req.params;

    const profile = await prisma.userProfile.findUnique({
      where:   { username: username.toLowerCase() },
      include: { socialLinks: true, user: { select: { id: true } } },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const isOwner = req.user && profile.user.id === req.user.id;

    if (!profile.isPublic && !isOwner) {
      return res.status(403).json({ success: false, message: 'Este perfil es privado.' });
    }

    // Obtener perfiles sociales con historial completo
    const socialProfiles = await prisma.socialProfile.findMany({
      where:  { userId: profile.user.id },
      select: { id: true, platform: true, username: true },
    });

    // Construir estadísticas con historial
    const stats       = await buildStats(socialProfiles);
    const rankPos     = await getRankPosition(profile.user.id);

    return res.json({
      success:      true,
      profile:      formatPublicProfile(profile, stats),
      rankPosition: rankPos,
      isOwner,
    });
  } catch (err) {
    console.error('getPublicProfile:', err);
    return res.status(500).json({ success: false, message: 'Error al obtener perfil', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  searchProfiles — GET /api/user-profile/search?q=jo&limit=8
// ═══════════════════════════════════════════════════════════════════════════════
export const searchProfiles = async (req, res) => {
  try {
    const q     = String(req.query.q || '').trim().toLowerCase();
    const limit = Math.min(parseInt(req.query.limit) || 8, 20);

    if (q.length < 1) return res.json({ success: true, results: [] });

    const profiles = await prisma.userProfile.findMany({
      where: {
        isPublic: true,
        OR: [
          { username:    { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, displayName: true, shortBio: true, avatarUrl: true },
      take:   limit,
    });

    // Priorizar starts-with
    const scored = profiles
      .map((p) => ({
        ...p,
        _score: p.username.startsWith(q) ? 2 : (p.displayName?.toLowerCase().startsWith(q) ? 1 : 0),
      }))
      .sort((a, b) => b._score - a._score)
      .map(({ _score, ...p }) => p);

    return res.json({ success: true, results: scored });
  } catch (err) {
    console.error('searchProfiles:', err);
    return res.status(500).json({ success: false, message: 'Error en búsqueda', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  exploreProfiles — GET /api/user-profile/explore?page=1
// ═══════════════════════════════════════════════════════════════════════════════
export const exploreProfiles = async (req, res) => {
  try {
    const page   = Math.max(parseInt(req.query.page) || 1, 1);
    const limit  = 12;
    const offset = (page - 1) * limit;

    const results = await prisma.$queryRaw`
      SELECT
        up.id,
        up.username,
        up.display_name          AS "displayName",
        up.short_bio             AS "shortBio",
        up.avatar_url            AS "avatarUrl",
        up.country,
        up.created_at            AS "createdAt",
        COALESCE(AVG(mh.engagement::numeric), 0)  AS "avgEngagement",
        COALESCE(MAX(mh.growth::numeric),     0)  AS "maxGrowth",
        COUNT(DISTINCT sp.id)::int                AS "profileCount"
      FROM user_profiles up
      LEFT JOIN social_profiles sp ON sp.user_id = up.user_id
      LEFT JOIN metrics_history mh ON mh.profile_id = sp.id
        AND mh.week_date >= (CURRENT_DATE - INTERVAL '30 days')
      WHERE up.is_public = true
      GROUP BY up.id, up.username, up.display_name, up.short_bio, up.avatar_url, up.country, up.created_at
      ORDER BY "avgEngagement" DESC, "profileCount" DESC, up.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const enriched = results.map((r, i) => ({
      ...r,
      avgEngagement: Number(r.avgEngagement).toFixed(2),
      maxGrowth:     Number(r.maxGrowth).toFixed(2),
      rankPosition:  offset + i + 1,
    }));

    const total = await prisma.userProfile.count({ where: { isPublic: true } });

    return res.json({
      success:    true,
      results:    enriched,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('exploreProfiles:', err);
    return res.status(500).json({ success: false, message: 'Error al explorar', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  upsertSocialLinks — PUT /api/user-profile/me/social-links
// ═══════════════════════════════════════════════════════════════════════════════
export const upsertSocialLinks = async (req, res) => {
  try {
    const { links } = req.body;

    if (!Array.isArray(links) || links.length === 0) {
      return res.status(400).json({ success: false, message: 'Envía un array "links" no vacío.' });
    }

    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Crea tu perfil antes de añadir redes.' });
    }

    const results = [];

    for (const link of links) {
      const { platform, url, label, isPublic = true, isActive = true } = link;
      if (!platform || !url) continue;

      const clean = String(platform).toLowerCase().trim();
      if (!VALID_SOCIAL_PLATFORMS.has(clean)) continue;

      const result = await prisma.socialLink.upsert({
        where:   { profileId_platform: { profileId: profile.id, platform: clean } },
        create:  { profileId: profile.id, platform: clean, url, label, isPublic, isActive },
        update:  { url, label, isPublic, isActive },
      });
      results.push(result);
    }

    return res.json({ success: true, message: 'Redes sociales actualizadas.', links: results });
  } catch (err) {
    console.error('upsertSocialLinks:', err);
    return res.status(500).json({ success: false, message: 'Error al guardar redes', error: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
//  deleteSocialLink — DELETE /api/user-profile/me/social-links/:id
// ═══════════════════════════════════════════════════════════════════════════════
export const deleteSocialLink = async (req, res) => {
  try {
    const { id } = req.params;

    const profile = await prisma.userProfile.findUnique({ where: { userId: req.user.id } });
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil no encontrado.' });

    const link = await prisma.socialLink.findFirst({ where: { id, profileId: profile.id } });
    if (!link)    return res.status(404).json({ success: false, message: 'Red social no encontrada.' });

    await prisma.socialLink.delete({ where: { id } });

    return res.json({ success: true, message: 'Red social eliminada.' });
  } catch (err) {
    console.error('deleteSocialLink:', err);
    return res.status(500).json({ success: false, message: 'Error al eliminar', error: err.message });
  }
};
