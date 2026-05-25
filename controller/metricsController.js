import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
//  CONFIGURACIÓN POR PLATAFORMA
// ─────────────────────────────────────────────────────────────────────────────
const PLATFORM_CONFIG = {
  youtube: {
    intFields:     ['views', 'likes', 'subscribers', 'paidMembers'],
    decimalFields: ['donations'],
    growthField:   'subscribers',
    buildDetail: (f) => ({
      views: f.views, likes: f.likes, subscribers: f.subscribers,
      paidMembers: f.paidMembers, donations: f.donations,
    }),
    calcEngagement: ({ likes, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat(((likes / views) * 100).toFixed(2)), 100);
    },
  },
  tiktok: {
    intFields:     ['views', 'likes', 'comments', 'favorites', 'shares', 'followers'],
    decimalFields: [],
    growthField:   'followers',
    buildDetail: (f) => ({
      views: f.views, likes: f.likes, comments: f.comments,
      favorites: f.favorites, shares: f.shares, followers: f.followers,
    }),
    calcEngagement: ({ likes, comments, favorites, shares, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat((((likes + comments + favorites + shares) / views) * 100).toFixed(2)), 100);
    },
  },
  twitch: {
    intFields:     ['views', 'followers', 'subscribersTwitch', 'bits'],
    decimalFields: [],
    growthField:   'followers',
    buildDetail: (f) => ({
      views: f.views, followers: f.followers,
      subscribersTwitch: f.subscribersTwitch, bits: f.bits,
    }),
    calcEngagement: ({ subscribersTwitch, followers }) => {
      if (followers === 0) return 0;
      return Math.min(parseFloat(((subscribersTwitch / followers) * 100).toFixed(2)), 100);
    },
  },
  instagram: {
    intFields:     ['views', 'likes', 'favorites', 'followers', 'posts'],
    decimalFields: [],
    growthField:   'followers',
    buildDetail: (f) => ({
      views: f.views, likes: f.likes, favorites: f.favorites,
      followers: f.followers, posts: f.posts,
    }),
    calcEngagement: ({ likes, favorites, views }) => {
      if (views === 0) return 0;
      return Math.min(parseFloat((((likes + favorites) / views) * 100).toFixed(2)), 100);
    },
  },
};

// Parsea un campo entero (>= 0, sin decimales).
const parseIntField = (raw, label) => {
  const n = parseInt(raw, 10);
  if (raw === undefined || raw === null || isNaN(n) || n < 0 || !Number.isInteger(Number(raw))) {
    return { value: null, error: `${label} debe ser un numero entero >= 0` };
  }
  return { value: n, error: null };
};

// Parsea un campo decimal (>= 0, permite decimales como 12.50).
const parseDecimalField = (raw, label) => {
  const n = parseFloat(raw);
  if (raw === undefined || raw === null || raw === '' || isNaN(n) || n < 0) {
    return { value: null, error: `${label} debe ser un numero >= 0 (puede tener decimales)` };
  }
  return { value: parseFloat(n.toFixed(2)), error: null };
};

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/metrics/:profileId
// ─────────────────────────────────────────────────────────────────────────────
export const createMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    // 1. Verificar propiedad del perfil
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

    // 2. Validar fecha
    const { weekDate } = req.body;
    if (!weekDate) return res.status(400).json({ success: false, message: 'weekDate es obligatorio' });
    const parsedDate = new Date(weekDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'weekDate debe ser YYYY-MM-DD' });
    }

    // 2b. Validar campos: enteros + decimales por separado
    const parsedFields = {};
    const fieldErrors  = [];

    for (const field of (config.intFields || [])) {
      const { value, error } = parseIntField(req.body[field], field);
      if (error) fieldErrors.push(error);
      else       parsedFields[field] = value;
    }

    for (const field of (config.decimalFields || [])) {
      const { value, error } = parseDecimalField(req.body[field], field);
      if (error) fieldErrors.push(error);
      else       parsedFields[field] = value;
    }

    if (fieldErrors.length > 0) {
      return res.status(400).json({ success: false, message: 'Errores de validacion', errors: fieldErrors });
    }

    // 3. Calcular engagement
    const engagement = config.calcEngagement(parsedFields);

    // 4. Buscar registro anterior para calcular growth
    // Prisma no acepta false en include, construimos el objeto dinamicamente.
    const prevInclude = {};
    prevInclude[platform] = true;

    const prevBase = await prisma.metricsHistory.findFirst({
      where: { profileId, weekDate: { lt: parsedDate } },
      orderBy: { weekDate: 'desc' },
      include: prevInclude,
    });

    let growth = null;
    if (prevBase) {
      const prevDetail = prevBase[platform];
      const prevValue  = prevDetail?.[config.growthField] ?? null;
      const currValue  = parsedFields[config.growthField];
      if (prevValue !== null && prevValue !== undefined) {
        const absolute = currValue - Number(prevValue);
        growth = Number(prevValue) === 0
          ? null
          : parseFloat(((absolute / Number(prevValue)) * 100).toFixed(2));
      }
    }

    // 5. Insercion en transaccion con switch explicito (Prisma 7 + driver-adapter)
    const result = await prisma.$transaction(async (tx) => {
      const base = await tx.metricsHistory.create({
        data: { profileId, weekDate: parsedDate, engagement, growth },
      });

      let detail;
      const detailData = { metricsId: base.id, ...config.buildDetail(parsedFields) };

      switch (platform) {
        case 'youtube':
          detail = await tx.metricsYoutube.create({ data: detailData });
          break;
        case 'tiktok':
          detail = await tx.metricsTiktok.create({ data: detailData });
          break;
        case 'twitch':
          detail = await tx.metricsTwitch.create({ data: detailData });
          break;
        case 'instagram':
          detail = await tx.metricsInstagram.create({ data: detailData });
          break;
        default:
          throw new Error(`Plataforma no soportada en transaccion: ${platform}`);
      }

      return { base, detail };
    });

    return res.status(201).json({
      success: true,
      message: 'Metricas guardadas correctamente',
      metrics: { ...result.base, detail: result.detail },
    });
  } catch (error) {
    console.error('=== ERROR createMetrics ===');
    console.error('message:', error.message);
    console.error('stack:', error.stack);
    return res.status(500).json({
      success: false,
      message: 'Error interno al guardar metricas',
      error: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/metrics/:profileId
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

    const platform = profile.platform?.toLowerCase();
    const flat = metrics.map((row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      return { ...base, ...detail };
    });

    return res.status(200).json({ success: true, metrics: flat });
  } catch (error) {
    console.error('Error al obtener metricas:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/metrics/summary
// ─────────────────────────────────────────────────────────────────────────────
export const getSummary = async (req, res) => {
  try {
    const profiles = await prisma.socialProfile.findMany({
      where: { userId: req.user.id },
      select: {
        id: true, platform: true, username: true,
        metrics: {
          orderBy: { weekDate: 'desc' },
          take: 1,
          include: { youtube: true, tiktok: true, twitch: true, instagram: true },
        },
      },
    });

    const followerField = {
      youtube: 'subscribers', tiktok: 'followers',
      twitch: 'followers',    instagram: 'followers',
    };

    let totalFollowers = 0;
    let totalViews     = 0;
    const engagements  = [];
    const platformBreakdown = { instagram: 0, tiktok: 0, youtube: 0, twitch: 0 };

    for (const profile of profiles) {
      const platform   = profile.platform?.toLowerCase();
      const lastMetric = profile.metrics[0];
      if (!lastMetric) continue;
      const detail = lastMetric[platform];
      if (!detail) continue;

      const fField    = followerField[platform];
      const followers = fField ? Number(detail[fField] ?? 0) : 0;
      totalFollowers += followers;
      if (platform in platformBreakdown) platformBreakdown[platform] += followers;

      totalViews += Number(detail.views ?? 0);

      if (lastMetric.engagement !== null && lastMetric.engagement !== undefined) {
        engagements.push(parseFloat(lastMetric.engagement));
      }
    }

    const avgEngagement = engagements.length > 0
      ? parseFloat((engagements.reduce((a, b) => a + b, 0) / engagements.length).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      summary: {
        totalProfiles: profiles.length,
        totalFollowers,
        totalViews,
        avgEngagement,
        platformBreakdown,
        profilesWithData: engagements.length,
      },
    });
  } catch (error) {
    console.error('Error al obtener resumen de metricas:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/metrics/compare/:profileId?period=1w
//  Compara las métricas actuales (última semana guardada) con las de hace 1
//  semana. Devuelve ambos conjuntos y las diferencias absolutas y porcentuales
//  campo a campo para mostrar tarjetas comparativas en el frontend.
// ─────────────────────────────────────────────────────────────────────────────
export const compareMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;
    // Por ahora solo soportamos period=1w (una semana atrás). Se puede ampliar.
    // const { period = '1w' } = req.query;  // reservado para futuros períodos

    // 1. Verificar propiedad del perfil
    const profile = await prisma.socialProfile.findFirst({
      where: { id: profileId, userId: req.user.id },
      select: { id: true, platform: true, username: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado o sin permisos' });
    }

    const platform = profile.platform?.toLowerCase();
    const config   = PLATFORM_CONFIG[platform];
    if (!config) {
      return res.status(400).json({ success: false, message: `Plataforma "${platform}" no soportada` });
    }

    // 2. Obtener los dos registros más recientes del perfil
    const includeDetail = {};
    includeDetail[platform] = true;

    const lastTwo = await prisma.metricsHistory.findMany({
      where:   { profileId },
      orderBy: { weekDate: 'desc' },
      take:    2,
      include: includeDetail,
    });

    if (lastTwo.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No hay métricas registradas para este perfil',
      });
    }

    // Aplanar un registro base + detalle de plataforma en un objeto plano
    const flatten = (row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      // Convertir Decimal de Prisma a número JS
      const toNum = (v) => (v !== null && v !== undefined ? parseFloat(v) : null);
      const result = { ...base };
      Object.keys(result).forEach((k) => {
        if (result[k] !== null && typeof result[k] === 'object' && typeof result[k].toFixed === 'function') {
          result[k] = toNum(result[k]);
        }
      });
      Object.keys(detail).forEach((k) => {
        const v = detail[k];
        result[k] = (v !== null && typeof v === 'object' && typeof v.toFixed === 'function')
          ? toNum(v)
          : v;
      });
      return result;
    };

    const current = flatten(lastTwo[0]);

    // Si solo hay un registro no podemos comparar
    if (lastTwo.length < 2) {
      return res.status(200).json({
        success:  true,
        message:  'Solo hay un registro; no se puede comparar todavía',
        platform,
        username: profile.username,
        current,
        previous: null,
        diff:     null,
      });
    }

    const previous = flatten(lastTwo[1]);

    // 3. Calcular diferencias campo a campo (campos numéricos de la plataforma
    //    más engagement y growth que son campos base de MetricsHistory)
    const numericFields = [
      ...config.intFields,
      ...(config.decimalFields || []),
      'engagement',
      'growth',
    ];

    const diff = {};
    for (const field of numericFields) {
      const curr = current[field]  !== undefined ? parseFloat(current[field])  : null;
      const prev = previous[field] !== undefined ? parseFloat(previous[field]) : null;

      if (curr === null || prev === null) {
        diff[field] = { absolute: null, percent: null };
        continue;
      }

      const absolute = parseFloat((curr - prev).toFixed(2));
      const percent  = prev !== 0
        ? parseFloat(((absolute / Math.abs(prev)) * 100).toFixed(2))
        : null;

      diff[field] = { absolute, percent };
    }

    return res.status(200).json({
      success:  true,
      platform,
      username: profile.username,
      current,
      previous,
      diff,
      fields:   numericFields,
    });
  } catch (error) {
    console.error('Error en compareMetrics:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};
