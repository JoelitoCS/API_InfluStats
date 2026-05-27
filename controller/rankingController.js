// ─────────────────────────────────────────────────────────────────────────────
//  controller/rankingController.js — Ranking público y comparativa entre perfiles
//
//  Funciones exportadas:
//    getRanking      → GET /api/ranking?platform=X&sort=Y
//    compareProfiles → GET /api/ranking/compare?profileA=uuid&profileB=uuid
//
//  Por qué es "público":
//    Cualquier usuario autenticado puede ver los rankings de TODOS los perfiles,
//    no solo los suyos. Es una funcionalidad social: los influencers se comparan
//    entre sí. La autenticación sigue siendo obligatoria (no es abierto al público).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma.js';

// Campo de seguidores/suscriptores por plataforma (para ordenar y mostrar en ranking)
const FOLLOWER_FIELD = {
  instagram: 'followers',
  tiktok:    'followers',
  twitch:    'followers',
  youtube:   'subscribers', // YouTube usa "suscriptores" en vez de "seguidores"
};

// Nombre de la relación Prisma con la tabla de detalle de cada plataforma
const DETAIL_RELATION = {
  instagram: 'instagram',
  tiktok:    'tiktok',
  twitch:    'twitch',
  youtube:   'youtube',
};

// ─────────────────────────────────────────────────────────────────────────────
//  getRanking — GET /api/ranking?platform=instagram&sort=followers
//
//  Devuelve todos los perfiles de una plataforma que tienen al menos un
//  registro de métricas, ordenados según el criterio pedido.
// ─────────────────────────────────────────────────────────────────────────────
export const getRanking = async (req, res) => {
  try {
    const platform = req.query.platform?.toLowerCase();
    const sort     = req.query.sort || 'followers'; // Criterio de ordenación por defecto

    // Validar que la plataforma sea una de las 4 soportadas
    if (!platform || !FOLLOWER_FIELD[platform]) {
      return res.status(400).json({
        success: false,
        message: 'platform es obligatorio: instagram | youtube | tiktok | twitch',
      });
    }

    const validSorts = ['followers', 'engagement', 'growth', 'views'];
    if (!validSorts.includes(sort)) {
      return res.status(400).json({
        success: false,
        message: `sort debe ser: ${validSorts.join(' | ')}`,
      });
    }

    // Incluir solo la tabla de detalle de la plataforma activa
    // (incluir las 4 siempre sería innecesario y más lento)
    const detailInclude = {};
    detailInclude[DETAIL_RELATION[platform]] = true;

    // Traer todos los perfiles de esa plataforma con su última métrica
    const profiles = await prisma.socialProfile.findMany({
      where:  { platform: { equals: platform, mode: 'insensitive' } }, // Case-insensitive
      select: {
        id: true, username: true, url: true, platform: true,
        user: { select: { name: true, email: true } },
        metrics: {
          orderBy: { weekDate: 'desc' },
          take:    1,              // Solo el último registro de cada perfil
          include: detailInclude,
        },
      },
    });

    // Filtrar: solo los que tienen al menos un registro de métricas
    const withData = profiles.filter((p) => p.metrics.length > 0);

    // Construir cada fila del ranking aplanando base + detalle
    const rows = withData.map((profile) => {
      const lastMetric = profile.metrics[0];
      const detail     = lastMetric[DETAIL_RELATION[platform]] || {};
      const fField     = FOLLOWER_FIELD[platform];

      return {
        profileId:   profile.id,
        username:    profile.username,
        url:         profile.url,
        platform:    profile.platform,
        displayName: profile.user?.name || profile.username, // Nombre real o username
        weekDate:    lastMetric.weekDate,
        followers:   Number(detail[fField] ?? 0),            // Seguidores o suscriptores
        views:       Number(detail.views   ?? 0),
        engagement:  parseFloat(Number(lastMetric.engagement ?? 0).toFixed(2)),
        growth:      lastMetric.growth !== null && lastMetric.growth !== undefined
          ? parseFloat(Number(lastMetric.growth).toFixed(2))
          : null,                                            // null en la primera semana
      };
    });

    // Ordenar según el criterio: mayor primero para todos excepto growth (null al final)
    rows.sort((a, b) => {
      if (sort === 'growth') {
        if (a.growth === null) return 1;  // null va al final
        if (b.growth === null) return -1;
        return b.growth - a.growth;
      }
      return b[sort] - a[sort]; // followers, engagement, views: mayor primero
    });

    // Añadir posición (1-indexed): el primero recibe position: 1
    const ranked = rows.map((row, i) => ({ position: i + 1, ...row }));

    return res.status(200).json({
      success:  true,
      platform, sort,
      total:    ranked.length,
      ranking:  ranked,
    });

  } catch (error) {
    console.error('Error al obtener ranking:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  compareProfiles — GET /api/ranking/compare?profileA=uuid&profileB=uuid
//
//  Compara las últimas métricas de dos perfiles públicos.
//  Ambos deben ser de la misma plataforma.
//
//  Resultado:
//    - Datos completos de cada perfil (último registro)
//    - diff: diferencias absolutas y porcentuales campo a campo
//    - score: cuántos campos gana cada perfil (A, B o empate)
// ─────────────────────────────────────────────────────────────────────────────
export const compareProfiles = async (req, res) => {
  try {
    const { profileA, profileB } = req.query;

    if (!profileA || !profileB) {
      return res.status(400).json({ success: false, message: 'Se requieren profileA y profileB' });
    }
    if (profileA === profileB) {
      return res.status(400).json({ success: false, message: 'profileA y profileB deben ser distintos' });
    }

    // Traer ambos perfiles en paralelo (Promise.all = más rápido que en serie)
    const [pA, pB] = await Promise.all([
      prisma.socialProfile.findUnique({
        where:  { id: profileA },
        select: {
          id: true, username: true, platform: true, url: true,
          user:    { select: { name: true } },
          metrics: {
            orderBy: { weekDate: 'desc' },
            take:    1,
            include: { youtube: true, tiktok: true, twitch: true, instagram: true },
          },
        },
      }),
      prisma.socialProfile.findUnique({
        where:  { id: profileB },
        select: {
          id: true, username: true, platform: true, url: true,
          user:    { select: { name: true } },
          metrics: {
            orderBy: { weekDate: 'desc' },
            take:    1,
            include: { youtube: true, tiktok: true, twitch: true, instagram: true },
          },
        },
      }),
    ]);

    if (!pA) return res.status(404).json({ success: false, message: 'profileA no encontrado' });
    if (!pB) return res.status(404).json({ success: false, message: 'profileB no encontrado' });

    const platA = pA.platform?.toLowerCase();
    const platB = pB.platform?.toLowerCase();

    // Solo se pueden comparar perfiles de la misma plataforma
    if (platA !== platB) {
      return res.status(400).json({
        success: false,
        message: `Los perfiles deben ser de la misma plataforma (${platA} vs ${platB})`,
      });
    }

    if (!pA.metrics.length) return res.status(404).json({ success: false, message: 'profileA no tiene métricas' });
    if (!pB.metrics.length) return res.status(404).json({ success: false, message: 'profileB no tiene métricas' });

    // Aplanar base + detalle en objeto plano con numbers (Decimal de Prisma → number JS)
    const flatten = (metric, platform) => {
      const detail = metric[platform] || {};
      const { youtube, tiktok, twitch, instagram, ...base } = metric;
      const { id: _did, metricsId: _mid, ...detailFields } = detail;
      const toNum = (v) => v !== null && v !== undefined ? parseFloat(v) : null;
      const result = { ...base };
      Object.keys(result).forEach((k) => {
        if (result[k] !== null && typeof result[k] === 'object' && typeof result[k].toFixed === 'function')
          result[k] = toNum(result[k]);
      });
      Object.keys(detailFields).forEach((k) => {
        const v = detailFields[k];
        result[k] = (v !== null && typeof v === 'object' && typeof v.toFixed === 'function') ? toNum(v) : v;
      });
      return result;
    };

    const platform = platA;
    const metA     = flatten(pA.metrics[0], platform);
    const metB     = flatten(pB.metrics[0], platform);

    // Campos a comparar según la plataforma
    const NUMERIC_FIELDS = {
      youtube:   ['views', 'likes', 'subscribers', 'paidMembers', 'donations', 'engagement', 'growth'],
      tiktok:    ['views', 'likes', 'comments', 'favorites', 'shares', 'followers', 'engagement', 'growth'],
      twitch:    ['views', 'followers', 'subscribersTwitch', 'bits', 'engagement', 'growth'],
      instagram: ['views', 'likes', 'favorites', 'followers', 'posts', 'engagement', 'growth'],
    };
    const fields = NUMERIC_FIELDS[platform] || [];

    // Calcular diferencias A - B para cada campo
    const diff = {};
    for (const field of fields) {
      const vA = metA[field] !== undefined && metA[field] !== null ? parseFloat(metA[field]) : null;
      const vB = metB[field] !== undefined && metB[field] !== null ? parseFloat(metB[field]) : null;
      if (vA === null || vB === null) {
        diff[field] = { absolute: null, percent: null, winner: null };
        continue;
      }
      const absolute = parseFloat((vA - vB).toFixed(2));
      const percent  = vB !== 0 ? parseFloat(((absolute / Math.abs(vB)) * 100).toFixed(2)) : null;
      diff[field] = {
        absolute, percent,
        winner: absolute > 0 ? 'A' : absolute < 0 ? 'B' : 'tie',
      };
    }

    // Marcador global: cuántos campos gana cada perfil
    const score = { A: 0, B: 0, tie: 0 };
    Object.values(diff).forEach(({ winner }) => {
      if (winner) score[winner]++;
    });

    return res.status(200).json({
      success: true, platform,
      profileA: { id: pA.id, username: pA.username, url: pA.url, name: pA.user?.name || pA.username, weekDate: metA.weekDate, metrics: metA },
      profileB: { id: pB.id, username: pB.username, url: pB.url, name: pB.user?.name || pB.username, weekDate: metB.weekDate, metrics: metB },
      diff, fields, score,
    });

  } catch (error) {
    console.error('compareProfiles:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};
