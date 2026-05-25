import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
//  Todas las rutas de este controlador están protegidas por protect + isAdmin.
//  El admin puede operar sobre cualquier usuario/perfil/métrica de la BD.
// ─────────────────────────────────────────────────────────────────────────────

// Configuración de plataformas (reutilizada localmente para recalcular engagement/growth)
const PLATFORM_CONFIG = {
  youtube: {
    intFields: ['views', 'likes', 'subscribers', 'paidMembers'], decimalFields: ['donations'],
    growthField: 'subscribers',
    calcEngagement: ({ likes, views }) => views === 0 ? 0 : Math.min(parseFloat(((likes / views) * 100).toFixed(2)), 100),
  },
  tiktok: {
    intFields: ['views', 'likes', 'comments', 'favorites', 'shares', 'followers'], decimalFields: [],
    growthField: 'followers',
    calcEngagement: ({ likes, comments, favorites, shares, views }) =>
      views === 0 ? 0 : Math.min(parseFloat((((likes + comments + favorites + shares) / views) * 100).toFixed(2)), 100),
  },
  twitch: {
    intFields: ['views', 'followers', 'subscribersTwitch', 'bits'], decimalFields: [],
    growthField: 'followers',
    calcEngagement: ({ subscribersTwitch, followers }) =>
      followers === 0 ? 0 : Math.min(parseFloat(((subscribersTwitch / followers) * 100).toFixed(2)), 100),
  },
  instagram: {
    intFields: ['views', 'likes', 'favorites', 'followers', 'posts'], decimalFields: [],
    growthField: 'followers',
    calcEngagement: ({ likes, favorites, views }) =>
      views === 0 ? 0 : Math.min(parseFloat((((likes + favorites) / views) * 100).toFixed(2)), 100),
  },
};

// ── GET /api/admin/users ──────────────────────────────────────────────────────
export const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, email: true, name: true, role: true,
        createdAt: true, lastLogin: true,
        _count: { select: { socialProfiles: true } },
      },
    });
    return res.status(200).json({ success: true, users });
  } catch (error) {
    console.error('admin.getUsers:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── DELETE /api/admin/users/:userId ──────────────────────────────────────────
export const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (userId === req.user.id) return res.status(400).json({ success: false, message: 'No puedes eliminarte a ti mismo' });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    await prisma.user.delete({ where: { id: userId } });
    return res.status(200).json({ success: true, message: `Usuario ${user.email} eliminado correctamente` });
  } catch (error) {
    console.error('admin.deleteUser:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── GET /api/admin/profiles ───────────────────────────────────────────────────
export const getAllProfiles = async (req, res) => {
  try {
    const profiles = await prisma.socialProfile.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        _count: { select: { metrics: true } },
      },
    });
    return res.status(200).json({ success: true, profiles });
  } catch (error) {
    console.error('admin.getAllProfiles:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── DELETE /api/admin/profiles/:profileId ────────────────────────────────────
export const deleteProfile = async (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = await prisma.socialProfile.findUnique({ where: { id: profileId } });
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
    await prisma.socialProfile.delete({ where: { id: profileId } });
    return res.status(200).json({ success: true, message: `Perfil @${profile.username} eliminado correctamente` });
  } catch (error) {
    console.error('admin.deleteProfile:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── GET /api/admin/metrics/:profileId ────────────────────────────────────────
// Devuelve todas las métricas de un perfil con los campos de detalle aplanados.
export const getMetricsByProfile = async (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = await prisma.socialProfile.findUnique({
      where: { id: profileId },
      select: { id: true, platform: true, username: true },
    });
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil no encontrado' });

    const metrics = await prisma.metricsHistory.findMany({
      where:   { profileId },
      orderBy: { weekDate: 'desc' },
      include: { youtube: true, tiktok: true, twitch: true, instagram: true },
    });

    const platform = profile.platform?.toLowerCase();
    const flat = metrics.map((row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      // El id del base (metricsHistory) debe mantenerse siempre.
      // Excluimos el id del detalle para que no sobreescriba el id base.
      const { id: _detailId, metricsId: _metricsId, ...detailFields } = detail;
      return { ...base, ...detailFields };
    });

    return res.status(200).json({ success: true, profile, metrics: flat });
  } catch (error) {
    console.error('admin.getMetricsByProfile:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── PUT /api/admin/metrics/:metricsId ────────────────────────────────────────
// Edita la weekDate y/o los campos numéricos de un registro.
// Recalcula engagement y growth automáticamente tras la edición.
export const updateMetric = async (req, res) => {
  try {
    const { metricsId } = req.params;

    // 1. Cargar registro + perfil + detalle de plataforma
    const existing = await prisma.metricsHistory.findUnique({
      where:   { id: metricsId },
      include: {
        profile:   { select: { id: true, platform: true } },
        youtube: true, tiktok: true, twitch: true, instagram: true,
      },
    });
    if (!existing) return res.status(404).json({ success: false, message: 'Registro no encontrado' });

    const platform  = existing.profile.platform?.toLowerCase();
    const profileId = existing.profile.id;
    const config    = PLATFORM_CONFIG[platform];
    if (!config) return res.status(400).json({ success: false, message: `Plataforma "${platform}" no soportada` });

    // 2. Validar y parsear weekDate
    let newWeekDate = existing.weekDate;
    if (req.body.weekDate) {
      const parsed = new Date(req.body.weekDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ success: false, message: 'weekDate no es una fecha válida (YYYY-MM-DD)' });
      }
      newWeekDate = parsed;
    }

    // 3. Mezclar campos actuales con los nuevos que lleguen en el body
    //    (parcial: solo se actualizan los que el admin envía)
    const currentDetail = existing[platform] || {};
    const allFields     = [...config.intFields, ...(config.decimalFields || [])];
    const mergedFields  = {};
    for (const f of allFields) {
      const incoming = req.body[f];
      mergedFields[f] = incoming !== undefined
        ? (config.decimalFields?.includes(f) ? parseFloat(Number(incoming).toFixed(2)) : parseInt(incoming, 10))
        : Number(currentDetail[f] ?? 0);
    }

    // 4. Recalcular engagement con los campos fusionados
    const newEngagement = config.calcEngagement(mergedFields);

    // 5. Recalcular growth buscando el registro anterior a la nueva fecha
    const includeDetail = {};
    includeDetail[platform] = true;
    const prevRow = await prisma.metricsHistory.findFirst({
      where:   { profileId, weekDate: { lt: newWeekDate }, id: { not: metricsId } },
      orderBy: { weekDate: 'desc' },
      include: includeDetail,
    });

    let newGrowth = null;
    if (prevRow) {
      const prevDetail = prevRow[platform];
      const prevValue  = prevDetail?.[config.growthField];
      const currValue  = mergedFields[config.growthField];
      if (prevValue !== null && prevValue !== undefined) {
        const abs = currValue - Number(prevValue);
        newGrowth = Number(prevValue) === 0
          ? null
          : parseFloat(((abs / Number(prevValue)) * 100).toFixed(2));
      }
    }

    // 6. Actualizar base + detalle en transacción
    await prisma.$transaction(async (tx) => {
      // Actualizar tabla base
      await tx.metricsHistory.update({
        where: { id: metricsId },
        data:  { weekDate: newWeekDate, engagement: newEngagement, growth: newGrowth },
      });

      // Actualizar tabla de detalle de la plataforma
      const detailId = existing[platform]?.id;
      if (!detailId) return;

      const detailUpdate = {};
      for (const f of config.intFields)              detailUpdate[f] = mergedFields[f];
      for (const f of (config.decimalFields || []))  detailUpdate[f] = mergedFields[f];

      switch (platform) {
        case 'youtube':   await tx.metricsYoutube.update(  { where: { id: detailId }, data: detailUpdate }); break;
        case 'tiktok':    await tx.metricsTiktok.update(   { where: { id: detailId }, data: detailUpdate }); break;
        case 'twitch':    await tx.metricsTwitch.update(   { where: { id: detailId }, data: detailUpdate }); break;
        case 'instagram': await tx.metricsInstagram.update({ where: { id: detailId }, data: detailUpdate }); break;
      }
    });

    return res.status(200).json({ success: true, message: 'Métrica actualizada correctamente' });
  } catch (error) {
    console.error('admin.updateMetric:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── DELETE /api/admin/metrics/:metricsId ─────────────────────────────────────
export const deleteMetric = async (req, res) => {
  try {
    const { metricsId } = req.params;
    const metric = await prisma.metricsHistory.findUnique({ where: { id: metricsId } });
    if (!metric) return res.status(404).json({ success: false, message: 'Registro de métricas no encontrado' });
    await prisma.metricsHistory.delete({ where: { id: metricsId } });
    return res.status(200).json({ success: true, message: 'Registro de métricas eliminado correctamente' });
  } catch (error) {
    console.error('admin.deleteMetric:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ── DELETE /api/admin/metrics/profile/:profileId/all ─────────────────────────
export const deleteAllMetricsByProfile = async (req, res) => {
  try {
    const { profileId } = req.params;
    const profile = await prisma.socialProfile.findUnique({ where: { id: profileId }, select: { username: true } });
    if (!profile) return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
    const { count } = await prisma.metricsHistory.deleteMany({ where: { profileId } });
    return res.status(200).json({
      success: true,
      message: `${count} registros de métricas eliminados del perfil @${profile.username}`,
      deleted: count,
    });
  } catch (error) {
    console.error('admin.deleteAllMetricsByProfile:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};
