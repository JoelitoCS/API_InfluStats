import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN POR PLATAFORMA
//
//  Cada entrada define:
//    - fields       : campos obligatorios que el cliente debe enviar.
//    - prismaModel  : nombre del modelo Prisma de la tabla detalle.
//    - buildDetail  : construye el objeto data para la tabla detalle.
//    - calcEngagement: calcula el engagement con los campos ya validados.
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_CONFIG = {

  youtube: {
    fields: ['views', 'likes', 'subscribers', 'paidMembers'],
    prismaModel: 'metricsYoutube',
    // Construye el objeto que se insertará en metrics_youtube.
    buildDetail: (f) => ({
      views:       f.views,
      likes:       f.likes,
      subscribers: f.subscribers,
      paidMembers: f.paidMembers,
    }),
    // Engagement = % de espectadores que dan like.
    calcEngagement: ({ likes, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat(((likes / views) * 100).toFixed(2)), 100);
    },
  },

  tiktok: {
    fields: ['views', 'likes', 'comments', 'favorites', 'shares', 'followers'],
    prismaModel: 'metricsTiktok',
    buildDetail: (f) => ({
      views:     f.views,
      likes:     f.likes,
      comments:  f.comments,
      favorites: f.favorites,
      shares:    f.shares,
      followers: f.followers,
    }),
    // Engagement = todas las interacciones sobre visualizaciones totales.
    calcEngagement: ({ likes, comments, favorites, shares, views }) => {
      if (views === 0) return 0;
      const interactions = likes + comments + favorites + shares;
      return Math.min(parseFloat(((interactions / views) * 100).toFixed(2)), 100);
    },
  },

  twitch: {
    fields: ['views', 'followers', 'subscribersTwitch', 'bits'],
    prismaModel: 'metricsTwitch',
    buildDetail: (f) => ({
      views:             f.views,
      followers:         f.followers,
      subscribersTwitch: f.subscribersTwitch,
      bits:              f.bits,
    }),
    // Engagement = % de seguidores que se han suscrito (Prime o pago).
    calcEngagement: ({ subscribersTwitch, followers }) => {
      if (followers === 0) return 0;
      return Math.min(parseFloat(((subscribersTwitch / followers) * 100).toFixed(2)), 100);
    },
  },

  instagram: {
    fields: ['views', 'likes', 'favorites', 'followers', 'posts'],
    prismaModel: 'metricsInstagram',
    buildDetail: (f) => ({
      views:     f.views,
      likes:     f.likes,
      favorites: f.favorites,
      followers: f.followers,
      posts:     f.posts,
    }),
    // Engagement = interacciones (likes + guardados) sobre visualizaciones.
    calcEngagement: ({ likes, favorites, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat((((likes + favorites) / views) * 100).toFixed(2)), 100);
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Función auxiliar: parsea y valida un campo como entero ≥ 0.
// ─────────────────────────────────────────────────────────────────────────────
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
//  1. Verificar que el perfil existe y pertenece al usuario del JWT.
//  2. Obtener la plataforma del perfil → elegir configuración.
//  3. Validar fecha + campos obligatorios de esa plataforma.
//  4. Calcular engagement con la fórmula de la plataforma.
//  5. Insertar en metrics_history (tabla base) y en la tabla detalle
//     de la plataforma, todo en una sola transacción.
// ─────────────────────────────────────────────────────────────────────────────
export const createMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    // ── 1. Verificación de propiedad del perfil ───────────────────────────
    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: req.user.id },
      select: { id: true, platform: true },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado o no tienes permisos para añadir métricas',
      });
    }

    // ── 2. Configuración de la plataforma ─────────────────────────────────
    const platform = profile.platform?.toLowerCase();
    const config   = PLATFORM_CONFIG[platform];

    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Plataforma "${platform}" no soportada para métricas`,
      });
    }

    // ── 3a. Validar fecha ─────────────────────────────────────────────────
    const { weekDate } = req.body;
    if (!weekDate) {
      return res.status(400).json({ success: false, message: 'weekDate es obligatorio' });
    }
    const parsedDate = new Date(weekDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'weekDate debe ser una fecha válida en formato YYYY-MM-DD',
      });
    }

    // ── 3b. Validar campos de la plataforma ───────────────────────────────
    const parsedFields = {};
    const fieldErrors  = [];

    for (const field of config.fields) {
      const { value, error } = parseIntField(req.body[field], field);
      if (error) fieldErrors.push(error);
      else       parsedFields[field] = value;
    }

    if (fieldErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors: fieldErrors,
      });
    }

    // ── 4. Calcular engagement ────────────────────────────────────────────
    const engagement = config.calcEngagement(parsedFields);

    // ── 5. Inserción en transacción ───────────────────────────────────────
    // Usamos $transaction para que si falla la inserción en la tabla detalle
    // también se revierta la fila de metrics_history. Ambas o ninguna.
    const result = await prisma.$transaction(async (tx) => {
      // 5a. Insertamos en la tabla base con los campos comunes.
      const base = await tx.metricsHistory.create({
        data: {
          profileId,
          weekDate:  parsedDate,
          engagement,
        },
      });

      // 5b. Insertamos en la tabla detalle de la plataforma.
      // prismaModel es el nombre del modelo Prisma ('metricsYoutube', etc.)
      const detail = await tx[config.prismaModel].create({
        data: {
          metricsId: base.id,           // FK → metrics_history.id
          ...config.buildDetail(parsedFields), // campos específicos de la plataforma
        },
      });

      return { base, detail };
    });

    return res.status(201).json({
      success: true,
      message: 'Métricas guardadas correctamente',
      metrics: {
        ...result.base,
        detail: result.detail,
      },
    });
  } catch (error) {
    console.error('Error al guardar métricas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al guardar métricas',
      error: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/metrics/:profileId
//  Devuelve el historial completo del perfil, incluyendo el detalle
//  de la tabla específica de la plataforma mediante include.
// ─────────────────────────────────────────────────────────────────────────────
export const getMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    // Verificamos propiedad antes de devolver datos.
    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: req.user.id },
      select: { id: true, platform: true },
    });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado o no tienes permisos',
      });
    }

    // Incluimos la tabla detalle de la plataforma en la respuesta.
    // Solo una de las cuatro relaciones tendrá datos; el resto será null.
    const metrics = await prisma.metricsHistory.findMany({
      where: { profileId },
      orderBy: { weekDate: 'desc' },
      include: {
        youtube:   true,
        tiktok:    true,
        twitch:    true,
        instagram: true,
      },
    });

    // Aplanamos la respuesta: movemos el detalle al nivel raíz para que
    // el frontend no tenga que buscar en cuál de las cuatro relaciones está.
    const platform = profile.platform?.toLowerCase();
    const flat = metrics.map((row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      return { ...base, ...detail };
    });

    return res.status(200).json({
      success: true,
      metrics: flat,
    });
  } catch (error) {
    console.error('Error al obtener métricas:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener métricas',
      error: error.message,
    });
  }
};
