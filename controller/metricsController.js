import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN POR PLATAFORMA
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_CONFIG = {
  youtube: {
    fields: ['views', 'likes', 'subscribers', 'paidMembers'],
    prismaModel: 'metricsYoutube',
    growthField: 'subscribers', // campo usado para calcular el crecimiento
    buildDetail: (f) => ({ views: f.views, likes: f.likes, subscribers: f.subscribers, paidMembers: f.paidMembers }),
    calcEngagement: ({ likes, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat(((likes / views) * 100).toFixed(2)), 100);
    },
  },
  tiktok: {
    fields: ['views', 'likes', 'comments', 'favorites', 'shares', 'followers'],
    prismaModel: 'metricsTiktok',
    growthField: 'followers',
    buildDetail: (f) => ({ views: f.views, likes: f.likes, comments: f.comments, favorites: f.favorites, shares: f.shares, followers: f.followers }),
    calcEngagement: ({ likes, comments, favorites, shares, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat((((likes + comments + favorites + shares) / views) * 100).toFixed(2)), 100);
    },
  },
  twitch: {
    fields: ['views', 'followers', 'subscribersTwitch', 'bits'],
    prismaModel: 'metricsTwitch',
    growthField: 'followers',
    buildDetail: (f) => ({ views: f.views, followers: f.followers, subscribersTwitch: f.subscribersTwitch, bits: f.bits }),
    calcEngagement: ({ subscribersTwitch, followers }) => {
      if (followers === 0) return 0;
      return Math.min(parseFloat(((subscribersTwitch / followers) * 100).toFixed(2)), 100);
    },
  },
  instagram: {
    fields: ['views', 'likes', 'favorites', 'followers', 'posts'],
    prismaModel: 'metricsInstagram',
    growthField: 'followers',
    buildDetail: (f) => ({ views: f.views, likes: f.likes, favorites: f.favorites, followers: f.followers, posts: f.posts }),
    calcEngagement: ({ likes, favorites, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat((((likes + favorites) / views) * 100).toFixed(2)), 100);
    },
  },
};

const parseIntField = (raw, label) => {
  const n = parseInt(raw, 10);
  if (raw === undefined || raw === null || isNaN(n) || n < 0 || !Number.isInteger(Number(raw))) {
    return { value: null, error: `${label} debe ser un número entero ≥ 0` };
  }
  return { value: n, error: null };
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/metrics/:profileId
//
//  Flujo:
//  1. Verificar propiedad del perfil → obtener plataforma.
//  2. Validar fecha y campos de la plataforma.
//  3. Buscar el registro anterior más reciente para calcular el growth.
//     El growth es el % de cambio del campo growthField respecto a la semana anterior.
//     Fórmula: ((actual - anterior) / anterior) * 100
//     Si no hay registro anterior → growth = NULL (primera entrada).
//  4. Insertar en metrics_history (base) + tabla detalle en transacción.
// ─────────────────────────────────────────────────────────────────────────────
export const createMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    // ── 1. Verificación de propiedad ──────────────────────────────────────
    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: req.user.id },
      select: { id: true, platform: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado o sin permisos' });
    }

    const platform = profile.platform?.toLowerCase();
    const config   = PLATFORM_CONFIG[platform];
    if (!config) {
      return res.status(400).json({ success: false, message: `Plataforma "${platform}" no soportada` });
    }

    // ── 2. Validar fecha ──────────────────────────────────────────────────
    const { weekDate } = req.body;
    if (!weekDate) return res.status(400).json({ success: false, message: 'weekDate es obligatorio' });
    const parsedDate = new Date(weekDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'weekDate debe ser YYYY-MM-DD' });
    }

    // ── 2b. Validar campos de la plataforma ───────────────────────────────
    const parsedFields = {};
    const fieldErrors  = [];
    for (const field of config.fields) {
      const { value, error } = parseIntField(req.body[field], field);
      if (error) fieldErrors.push(error);
      else       parsedFields[field] = value;
    }
    if (fieldErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Errores de validación', errors: fieldErrors });
    }

    // ── 3. Calcular engagement ────────────────────────────────────────────
    const engagement = config.calcEngagement(parsedFields);

    // ── 4. Buscar el registro anterior para calcular growth ───────────────
    // Buscamos la entrada más reciente ANTES de la fecha actual para este perfil.
    // Incluimos la tabla detalle para leer el valor del campo growthField.
    const prevBase = await prisma.metricsHistory.findFirst({
      where: {
        profileId,
        weekDate: { lt: parsedDate }, // estrictamente anterior
      },
      orderBy: { weekDate: 'desc' },  // el más reciente de los anteriores
      include: {
        youtube:   platform === 'youtube',
        tiktok:    platform === 'tiktok',
        twitch:    platform === 'twitch',
        instagram: platform === 'instagram',
      },
    });

    // Extraemos el valor anterior del campo de crecimiento de la tabla detalle.
    let growth = null;
    if (prevBase) {
      const prevDetail  = prevBase[platform];
      const prevValue   = prevDetail?.[config.growthField] ?? null;
      const currValue   = parsedFields[config.growthField];

      if (prevValue !== null && prevValue !== undefined) {
        // Diferencia absoluta (puede ser negativa = pérdida de seguidores).
        const absolute = currValue - Number(prevValue);
        // Porcentaje de crecimiento redondeado a 2 decimales.
        // Si el valor anterior era 0 guardamos null para evitar Infinity.
        growth = Number(prevValue) === 0
          ? null
          : parseFloat(((absolute / Number(prevValue)) * 100).toFixed(2));
      }
    }

    // ── 5. Inserción en transacción ───────────────────────────────────────
    // Si falla la tabla detalle se revierte también la fila base. Ambas o ninguna.
    const result = await prisma.$transaction(async (tx) => {
      const base = await tx.metricsHistory.create({
        data: { profileId, weekDate: parsedDate, engagement, growth },
      });
      const detail = await tx[config.prismaModel].create({
        data: { metricsId: base.id, ...config.buildDetail(parsedFields) },
      });
      return { base, detail };
    });

    return res.status(201).json({
      success: true,
      message: 'Métricas guardadas correctamente',
      metrics: { ...result.base, detail: result.detail },
    });
  } catch (error) {
    console.error('Error al guardar métricas:', error);
    return res.status(500).json({ success: false, message: 'Error interno al guardar métricas', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/metrics/:profileId
//  Devuelve el historial aplanado con engagement + growth + campos de la plataforma.
// ─────────────────────────────────────────────────────────────────────────────
export const getMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: req.user.id },
      select: { id: true, platform: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado o sin permisos' });
    }

    const metrics = await prisma.metricsHistory.findMany({
      where: { profileId },
      orderBy: { weekDate: 'desc' },
      include: { youtube: true, tiktok: true, twitch: true, instagram: true },
    });

    // Aplanamos: movemos los campos del detalle al nivel raíz.
    const platform = profile.platform?.toLowerCase();
    const flat = metrics.map((row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      return { ...base, ...detail };
    });

    return res.status(200).json({ success: true, metrics: flat });
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};
