import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/ranking?platform=instagram&sort=followers
//
//  Devuelve el ranking público de todos los perfiles registrados de una plataforma.
//  Solo aparecen perfiles que tengan al menos UN registro de métricas.
//  La autenticación es obligatoria (protect) — solo usuarios registrados pueden ver el ranking.
//
//  Query params:
//    platform  : "instagram" | "youtube" | "tiktok" | "twitch"  (requerido)
//    sort      : "followers" | "engagement" | "growth" | "views" (default: followers)
// ─────────────────────────────────────────────────────────────────────────────

// Campo de seguidores/suscriptores por plataforma (para el sort y el display)
const FOLLOWER_FIELD = {
  instagram: 'followers',
  tiktok:    'followers',
  twitch:    'followers',
  youtube:   'subscribers',
};

// Relación Prisma de la tabla detalle por plataforma
const DETAIL_RELATION = {
  instagram: 'instagram',
  tiktok:    'tiktok',
  twitch:    'twitch',
  youtube:   'youtube',
};

export const getRanking = async (req, res) => {
  try {
    const platform = req.query.platform?.toLowerCase();
    const sort     = req.query.sort || 'followers';

    // Validaciones básicas
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

    // Incluir solo la tabla detalle de la plataforma activa
    const detailInclude = {};
    detailInclude[DETAIL_RELATION[platform]] = true;

    // Obtener todos los perfiles de la plataforma con su última métrica
    const profiles = await prisma.socialProfile.findMany({
      where: { platform: { equals: platform, mode: 'insensitive' } },
      select: {
        id:       true,
        username: true,
        url:      true,
        platform: true,
        user: {
          select: { name: true, email: true },
        },
        metrics: {
          orderBy: { weekDate: 'desc' },
          take: 1,
          include: detailInclude,
        },
      },
    });

    // Filtrar solo los que tienen al menos una semana de datos
    const withData = profiles.filter((p) => p.metrics.length > 0);

    // Construir filas del ranking aplanando el detalle
    const rows = withData.map((profile) => {
      const lastMetric = profile.metrics[0];
      const detail     = lastMetric[DETAIL_RELATION[platform]] || {};
      const fField     = FOLLOWER_FIELD[platform];

      return {
        profileId:  profile.id,
        username:   profile.username,
        url:        profile.url,
        platform:   profile.platform,
        // Nombre del usuario (puede ser null si no lo rellenó)
        displayName: profile.user?.name || profile.username,
        // Semana del último registro
        weekDate:   lastMetric.weekDate,
        // Métricas clave
        followers:  Number(detail[fField] ?? 0),
        views:      Number(detail.views   ?? 0),
        engagement: parseFloat(Number(lastMetric.engagement ?? 0).toFixed(2)),
        growth:     lastMetric.growth !== null && lastMetric.growth !== undefined
          ? parseFloat(Number(lastMetric.growth).toFixed(2))
          : null,
      };
    });

    // Ordenar según el criterio pedido
    rows.sort((a, b) => {
      if (sort === 'growth') {
        // Los null (primera semana) van al final
        if (a.growth === null) return 1;
        if (b.growth === null) return -1;
        return b.growth - a.growth;
      }
      return b[sort] - a[sort]; // followers, engagement, views: mayor primero
    });

    // Añadir posición (1-indexed)
    const ranked = rows.map((row, i) => ({ position: i + 1, ...row }));

    return res.status(200).json({
      success:  true,
      platform,
      sort,
      total:    ranked.length,
      ranking:  ranked,
    });
  } catch (error) {
    console.error('Error al obtener ranking:', error);
    return res.status(500).json({ success: false, message: 'Error interno', error: error.message });
  }
};
