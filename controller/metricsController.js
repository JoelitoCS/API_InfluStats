// ─────────────────────────────────────────────────────────────────────────────
//  controller/metricsController.js — Métricas semanales
//
//  Funciones exportadas:
//    createMetrics  → POST /api/metrics/:profileId
//    getMetrics     → GET  /api/metrics/:profileId
//    getStaleness   → GET  /api/metrics/staleness
//    getSummary     → GET  /api/metrics/summary
//    compareMetrics → GET  /api/metrics/compare/:profileId
//
//  Diseño de la BD (tabla partida por plataforma):
//    MetricsHistory: fila base con engagement y growth (calculados por el servidor).
//    MetricsYoutube / MetricsTiktok / MetricsTwitch / MetricsInstagram:
//      tablas de detalle 1:1 con los campos específicos de cada red social.
//    Al leer aplanamos base + detalle en un único objeto JS para el frontend.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma.js';

// ── PLATFORM_CONFIG ───────────────────────────────────────────────────────────
// Objeto de configuración centralizado por plataforma.
// Evita tener if/else repartidos por todo el controlador.
// Al añadir una nueva plataforma solo hay que añadir su entrada aquí.
const PLATFORM_CONFIG = {
  youtube: {
    intFields:     ['views', 'likes', 'subscribers', 'paidMembers'], // Campos enteros
    decimalFields: ['donations'],                                     // Campos decimales (€)
    growthField:   'subscribers',       // Campo que se usa para calcular el crecimiento %
    // buildDetail: construye el objeto que se inserta en MetricsYoutube
    buildDetail: (f) => ({
      views: f.views, likes: f.likes, subscribers: f.subscribers,
      paidMembers: f.paidMembers, donations: f.donations,
    }),
    // Engagement YouTube = (likes / visitas) × 100
    calcEngagement: ({ likes, views }) => {
      if (views === 0) return 0;
      return Math.max(parseFloat(((likes / views) * 100).toFixed(2)), 0);
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
    // Engagement TikTok = ((likes + comentarios + favoritos + compartidos) / visitas) × 100
    calcEngagement: ({ likes, comments, favorites, shares, views }) => {
      if (views === 0) return 0;
      return Math.max(parseFloat((((likes + comments + favorites + shares) / views) * 100).toFixed(2)), 0);
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
    // Engagement Twitch = (suscriptores / seguidores) × 100
    calcEngagement: ({ subscribersTwitch, followers }) => {
      if (followers === 0) return 0;
      return Math.max(parseFloat(((subscribersTwitch / followers) * 100).toFixed(2)), 0);
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
    // Engagement Instagram = ((likes + guardados) / visitas) × 100
    calcEngagement: ({ likes, favorites, views }) => {
      if (views === 0) return 0;
      return Math.max(parseFloat((((likes + favorites) / views) * 100).toFixed(2)), 0);
    },
  },
};

// parseIntField: convierte a entero y valida. Rechaza negativos y decimales.
const parseIntField = (raw, label) => {
  const n = parseInt(raw, 10);
  if (raw === undefined || raw === null || isNaN(n) || n < 0 || !Number.isInteger(Number(raw))) {
    return { value: null, error: `${label} debe ser un numero entero >= 0` };
  }
  return { value: n, error: null };
};

// parseDecimalField: convierte a decimal y valida. Acepta 12, 12.5, "12.50".
const parseDecimalField = (raw, label) => {
  const n = parseFloat(raw);
  if (raw === undefined || raw === null || raw === '' || isNaN(n) || n < 0) {
    return { value: null, error: `${label} debe ser un numero >= 0 (puede tener decimales)` };
  }
  return { value: parseFloat(n.toFixed(2)), error: null };
};

// ─────────────────────────────────────────────────────────────────────────────
//  createMetrics — POST /api/metrics/:profileId
//
//  Flujo:
//    1. Verificar propiedad del perfil
//    2. Validar weekDate y campos numéricos según la plataforma
//    3. Calcular engagement automáticamente
//    4. Buscar registro anterior para calcular crecimiento %
//    5. Insertar en transacción: MetricsHistory + tabla de detalle
// ─────────────────────────────────────────────────────────────────────────────
export const createMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    // 1. Verificar propiedad
    const profile = await prisma.socialProfile.findFirst({
      where:  { id: profileId, userId: req.user.id },
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

    // 2. Validar weekDate
    const { weekDate } = req.body;
    if (!weekDate) return res.status(400).json({ success: false, message: 'weekDate es obligatorio' });
    const parsedDate = new Date(weekDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'weekDate debe ser YYYY-MM-DD' });
    }

    // Validar campos numéricos según la plataforma
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

    // 3. Calcular engagement (el cliente nunca lo envía)
    const engagement = config.calcEngagement(parsedFields);

    // 4. Buscar el registro anterior para calcular crecimiento %
    // prevInclude se construye dinámicamente: solo incluimos la plataforma activa
    const prevInclude = {};
    prevInclude[platform] = true;

    const prevBase = await prisma.metricsHistory.findFirst({
      where:   { profileId, weekDate: { lt: parsedDate } },
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
        // Si prevValue === 0, la división produce Infinity → growth null
        growth = Number(prevValue) === 0
          ? null
          : parseFloat(((absolute / Number(prevValue)) * 100).toFixed(2));
      }
    }

    // 5. Insertar base + detalle de forma secuencial (compatible con PgBouncer)
    // PgBouncer en modo transaction pooling no soporta prisma.$transaction interactivo.
    // Insertamos la fila base primero y, si falla el detalle, la borramos (rollback manual).
    const base = await prisma.metricsHistory.create({
      data: { profileId, weekDate: parsedDate, engagement, growth },
    });

    let detail;
    try {
      const detailData = { metricsId: base.id, ...config.buildDetail(parsedFields) };
      switch (platform) {
        case 'youtube':   detail = await prisma.metricsYoutube.create({ data: detailData });   break;
        case 'tiktok':    detail = await prisma.metricsTiktok.create({ data: detailData });    break;
        case 'twitch':    detail = await prisma.metricsTwitch.create({ data: detailData });    break;
        case 'instagram': detail = await prisma.metricsInstagram.create({ data: detailData }); break;
        default: throw new Error(`Plataforma no soportada: ${platform}`);
      }
    } catch (detailError) {
      // Rollback manual: eliminar la fila base si el detalle falla
      await prisma.metricsHistory.delete({ where: { id: base.id } }).catch(() => {});
      throw detailError;
    }

    const result = { base, detail };

    return res.status(201).json({
      success: true,
      message: 'Metricas guardadas correctamente',
      metrics: { ...result.base, detail: result.detail },
    });

  } catch (error) {
    console.error('=== ERROR createMetrics ===', error.message);
    return res.status(500).json({ success: false, message: 'Error interno al guardar metricas', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getMetrics — GET /api/metrics/:profileId
//
//  Devuelve el historial completo, más reciente primero.
//  Aplana base + detalle en un único objeto por fila.
// ─────────────────────────────────────────────────────────────────────────────
export const getMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    const profile = await prisma.socialProfile.findFirst({
      where:  { id: profileId, userId: req.user.id },
      select: { id: true, platform: true },
    });
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado o sin permisos' });
    }

    // include con las 4 tablas de detalle; Prisma devuelve null las que no corresponden
    const metrics = await prisma.metricsHistory.findMany({
      where:   { profileId },
      orderBy: { weekDate: 'desc' },
      include: { youtube: true, tiktok: true, twitch: true, instagram: true },
    });

    const platform = profile.platform?.toLowerCase();
    const flat = metrics.map((row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      // Excluir id del detalle y metricsId para no sobreescribir el id base
      const { id: _detailId, metricsId: _metricsId, ...detailFields } = detail;
      return { ...base, ...detailFields };
    });

    return res.status(200).json({ success: true, metrics: flat });

  } catch (error) {
    console.error('Error al obtener metricas:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getStaleness — GET /api/metrics/staleness
//
//  Perfiles del usuario con más de 7 días sin métricas.
//  El dashboard muestra un banner de aviso con estos perfiles.
// ─────────────────────────────────────────────────────────────────────────────
export const getStaleness = async (req, res) => {
  try {
    const STALE_DAYS = 7;
    const threshold  = new Date();
    threshold.setDate(threshold.getDate() - STALE_DAYS);

    const profiles = await prisma.socialProfile.findMany({
      where:  { userId: req.user.id },
      select: {
        id: true, platform: true, username: true, needsUpdate: true,
        metrics: {
          orderBy: { weekDate: 'desc' },
          take:    1,
          select:  { weekDate: true },
        },
      },
    });

    const stale = profiles
      .map((p) => {
        const lastDate = p.metrics[0]?.weekDate ?? null;
        // 86_400_000 ms = 1 día; Math.floor para enteros
        const daysAgo  = lastDate
          ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86_400_000)
          : null;
        return {
          id: p.id, platform: p.platform, username: p.username,
          needsUpdate: p.needsUpdate,
          lastDate: lastDate ? new Date(lastDate).toISOString().split('T')[0] : null,
          daysAgo,
          stale: lastDate === null || new Date(lastDate) < threshold,
        };
      })
      .filter((p) => p.stale);

    return res.status(200).json({ success: true, stale });

  } catch (error) {
    console.error('getStaleness:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  getSummary — GET /api/metrics/summary
//
//  Métricas agregadas de todos los perfiles del usuario para el dashboard.
//  Calcula: totalFollowers, totalViews, avgEngagement, platformBreakdown.
// ─────────────────────────────────────────────────────────────────────────────
export const getSummary = async (req, res) => {
  try {
    const profiles = await prisma.socialProfile.findMany({
      where:  { userId: req.user.id },
      select: {
        id: true, platform: true, username: true,
        metrics: {
          orderBy: { weekDate: 'desc' },
          take:    1,
          include: { youtube: true, tiktok: true, twitch: true, instagram: true },
        },
      },
    });

    // Cada plataforma tiene un campo diferente para seguidores/suscriptores
    const followerField = {
      youtube: 'subscribers', tiktok: 'followers',
      twitch:  'followers',   instagram: 'followers',
    };

    let totalFollowers = 0;
    let totalViews     = 0;
    const engagements  = [];
    const platformBreakdown = { instagram: 0, tiktok: 0, youtube: 0, twitch: 0 };

    for (const profile of profiles) {
      const platform   = profile.platform?.toLowerCase();
      const lastMetric = profile.metrics[0];
      if (!lastMetric) continue; // Sin datos: saltar

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

    // Promedio: reduce suma todos y dividimos por la cantidad
    const avgEngagement = engagements.length > 0
      ? parseFloat((engagements.reduce((a, b) => a + b, 0) / engagements.length).toFixed(2))
      : 0;

    return res.status(200).json({
      success: true,
      summary: {
        totalProfiles:    profiles.length,
        totalFollowers, totalViews, avgEngagement,
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
//  compareMetrics — GET /api/metrics/compare/:profileId?period=1w
//
//  Compara el registro actual con el de un período anterior.
//  Busca el registro más cercano a (fechaActual - N días), tanto antes como
//  después, y calcula diferencias absolutas y porcentuales campo a campo.
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_DAYS   = { '1w': 7, '2w': 14, '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
const VALID_PERIODS = Object.keys(PERIOD_DAYS);

export const compareMetrics = async (req, res) => {
  try {
    const { profileId }               = req.params;
    const { period = '1w', fromDate } = req.query;

    const isCustom = period === 'custom';
    if (!VALID_PERIODS.includes(period) && !isCustom) {
      return res.status(400).json({
        success: false,
        message: `Período no válido. Usa: ${VALID_PERIODS.join(', ')} o custom&fromDate=YYYY-MM-DD`,
      });
    }
    if (isCustom && !fromDate) {
      return res.status(400).json({ success: false, message: 'custom requiere el param fromDate=YYYY-MM-DD' });
    }

    const profile = await prisma.socialProfile.findFirst({
      where:  { id: profileId, userId: req.user.id },
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

    const includeDetail = {};
    includeDetail[platform] = true;

    // Registro más reciente (el "actual")
    const currentRow = await prisma.metricsHistory.findFirst({
      where: { profileId }, orderBy: { weekDate: 'desc' }, include: includeDetail,
    });
    if (!currentRow) {
      return res.status(404).json({ success: false, message: 'No hay métricas registradas para este perfil' });
    }

    // Calcular fecha de referencia para el registro "anterior"
    const currentDate = new Date(currentRow.weekDate);
    let referenceDate;
    if (isCustom) {
      referenceDate = new Date(fromDate);
    } else {
      referenceDate = new Date(currentDate);
      referenceDate.setDate(referenceDate.getDate() - PERIOD_DAYS[period]);
    }

    // Buscar el registro más cercano (por debajo y por encima de referenceDate)
    const [beforeRow, afterRow] = await Promise.all([
      prisma.metricsHistory.findFirst({
        where: { profileId, weekDate: { lte: referenceDate }, id: { not: currentRow.id } },
        orderBy: { weekDate: 'desc' }, include: includeDetail,
      }),
      prisma.metricsHistory.findFirst({
        where: { profileId, weekDate: { gt: referenceDate }, id: { not: currentRow.id } },
        orderBy: { weekDate: 'asc' }, include: includeDetail,
      }),
    ]);

    // Elegir el más cercano en días (menor distancia absoluta)
    let previousRow = null;
    if (beforeRow && afterRow) {
      const distBefore = Math.abs(new Date(beforeRow.weekDate) - referenceDate);
      const distAfter  = Math.abs(new Date(afterRow.weekDate)  - referenceDate);
      previousRow = distBefore <= distAfter ? beforeRow : afterRow;
    } else {
      previousRow = beforeRow || afterRow || null;
    }

    // Aplanar fila Prisma en objeto JS plano convirtiendo Decimal → number
    const flatten = (row) => {
      const detail = row[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = row;
      const toNum  = (v) => (v !== null && v !== undefined ? parseFloat(v) : null);
      const result = { ...base };
      Object.keys(result).forEach((k) => {
        if (result[k] !== null && typeof result[k] === 'object' && typeof result[k].toFixed === 'function')
          result[k] = toNum(result[k]);
      });
      Object.keys(detail).forEach((k) => {
        const v = detail[k];
        result[k] = (v !== null && typeof v === 'object' && typeof v.toFixed === 'function') ? toNum(v) : v;
      });
      return result;
    };

    const current  = flatten(currentRow);
    const previous = previousRow ? flatten(previousRow) : null;

    const numericFields = [...config.intFields, ...(config.decimalFields || []), 'engagement', 'growth'];

    if (!previous) {
      return res.status(200).json({
        success: true, message: `No hay datos para el período «${period}»`,
        platform, username: profile.username, period,
        referenceDate: referenceDate.toISOString().split('T')[0],
        current, previous: null, diff: null, fields: numericFields,
      });
    }

    // Calcular diferencias campo a campo
    const diff = {};
    for (const field of numericFields) {
      const curr = current[field]  !== undefined ? parseFloat(current[field])  : null;
      const prev = previous[field] !== undefined ? parseFloat(previous[field]) : null;
      if (curr === null || prev === null) { diff[field] = { absolute: null, percent: null }; continue; }
      const absolute = parseFloat((curr - prev).toFixed(2));
      const percent  = prev !== 0 ? parseFloat(((absolute / Math.abs(prev)) * 100).toFixed(2)) : null;
      diff[field] = { absolute, percent };
    }

    return res.status(200).json({
      success: true, platform, username: profile.username, period,
      referenceDate: referenceDate.toISOString().split('T')[0],
      current, previous, diff, fields: numericFields,
    });

  } catch (error) {
    console.error('Error en compareMetrics:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};
