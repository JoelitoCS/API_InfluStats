/**
 * lib/cron.js
 *
 * Cron job que se ejecuta una vez al arrancar y luego cada 24 horas.
 * Revisa todos los perfiles sociales de la BD y marca needs_update = true
 * en aquellos cuya última métrica tenga más de 7 días de antigüedad,
 * o que nunca hayan tenido métricas registradas.
 *
 * No depende de ninguna librería externa: usa setInterval nativo de Node.js.
 */

import { prisma } from './prisma.js';

const STALE_DAYS    = 7;
const INTERVAL_MS   = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Calcula el umbral de "obsoleto": hace STALE_DAYS días a las 00:00:00.
 */
const getThreshold = () => {
  const t = new Date();
  t.setDate(t.getDate() - STALE_DAYS);
  t.setHours(0, 0, 0, 0);
  return t;
};

/**
 * Lógica principal del job:
 * 1. Obtiene todos los perfiles con su última métrica.
 * 2. Determina cuáles necesitan actualización.
 * 3. Actualiza needs_update en lote con dos updateMany.
 *
 * @returns {{ marked: number, cleared: number }} Perfiles marcados y limpiados.
 */
export async function runStaleCheck() {
  const threshold = getThreshold();

  // Traer todos los perfiles con solo la fecha de su última métrica
  const profiles = await prisma.socialProfile.findMany({
    select: {
      id: true,
      metrics: {
        orderBy: { weekDate: 'desc' },
        take:    1,
        select:  { weekDate: true },
      },
    },
  });

  const staleIds   = [];
  const freshIds   = [];

  for (const p of profiles) {
    const lastDate = p.metrics[0]?.weekDate ?? null;
    // Stale si: nunca tuvo datos  O  la última entrada es anterior al umbral
    const isStale  = lastDate === null || new Date(lastDate) < threshold;
    (isStale ? staleIds : freshIds).push(p.id);
  }

  // Actualización en paralelo para mayor eficiencia
  const [marked, cleared] = await Promise.all([
    staleIds.length > 0
      ? prisma.socialProfile.updateMany({
          where: { id: { in: staleIds }, needsUpdate: false },
          data:  { needsUpdate: true },
        })
      : { count: 0 },
    freshIds.length > 0
      ? prisma.socialProfile.updateMany({
          where: { id: { in: freshIds }, needsUpdate: true },
          data:  { needsUpdate: false },
        })
      : { count: 0 },
  ]);

  return { marked: marked.count, cleared: cleared.count };
}

/**
 * Arranca el cron job:
 * - Ejecuta el check inmediatamente al iniciar.
 * - Programa una ejecución cada 24 horas.
 */
export function startCron() {
  const run = async () => {
    try {
      console.log('[cron] Revisando perfiles desactualizados…');
      const { marked, cleared } = await runStaleCheck();
      console.log(`[cron] ✓ Marcados: ${marked} | Limpiados: ${cleared} | ${new Date().toISOString()}`);
    } catch (err) {
      console.error('[cron] ✗ Error en stale check:', err.message);
    }
  };

  // Ejecución inmediata al arrancar
  run();

  // Ejecución periódica cada 24 horas
  const timer = setInterval(run, INTERVAL_MS);

  // Evitar que el timer bloquee el cierre limpio del proceso
  timer.unref();

  console.log(`[cron] Stale check programado cada 24h (umbral: ${STALE_DAYS} días)`);
}
