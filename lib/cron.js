// ─────────────────────────────────────────────────────────────────────────────
//  lib/cron.js — Job periódico de detección de perfiles desactualizados
//
//  Qué hace:
//    Cada 24 horas revisa todos los perfiles de la BD y pone needsUpdate=true
//    en los que llevan más de 7 días sin un registro de métricas.
//    También pone needsUpdate=false en los que sí están al día.
//
//  Por qué no usamos una librería de cron (node-cron, etc.):
//    setInterval de Node.js es suficiente para un intervalo fijo de 24h.
//    No necesitamos expresiones cron con horarios específicos (ej: "todos
//    los lunes a las 9am"), así que la solución nativa es más simple y
//    sin dependencias extra.
//
//  timer.unref():
//    Evita que el setInterval mantenga el proceso vivo si Express ya cerró.
//    Sin unref(), Node esperaría al timer antes de terminar el proceso.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from './prisma.js';

const STALE_DAYS  = 7;                      // Días sin métricas para marcar como obsoleto
const INTERVAL_MS = 24 * 60 * 60 * 1000;   // 24 horas en milisegundos

/**
 * Calcula la fecha límite: hace STALE_DAYS días a medianoche.
 * Los perfiles cuya última métrica sea anterior a esta fecha quedan marcados.
 */
const getThreshold = () => {
  const t = new Date();
  t.setDate(t.getDate() - STALE_DAYS);
  t.setHours(0, 0, 0, 0); // Normalizar a medianoche para comparaciones estables
  return t;
};

/**
 * runStaleCheck — lógica principal del job
 *
 * Pasos:
 *  1. Trae todos los perfiles con solo la fecha de su último registro de métricas.
 *  2. Clasifica cada perfil como "stale" (obsoleto) o "fresh" (al día).
 *  3. Actualiza needsUpdate en lote con dos updateMany en paralelo.
 *
 * @returns {{ marked: number, cleared: number }}
 */
export async function runStaleCheck() {
  const threshold = getThreshold();

  // Traemos solo el campo que necesitamos: la fecha de la métrica más reciente.
  // take: 1 + orderBy: desc nos da solo el último registro de cada perfil.
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

  const staleIds = []; // Perfiles que necesitan actualización
  const freshIds = []; // Perfiles que están al día

  for (const p of profiles) {
    const lastDate = p.metrics[0]?.weekDate ?? null;
    // Es obsoleto si nunca tuvo métricas O si la última entrada es anterior al umbral
    const isStale  = lastDate === null || new Date(lastDate) < threshold;
    (isStale ? staleIds : freshIds).push(p.id);
  }

  // Promise.all ejecuta las dos updateMany en paralelo (más eficiente que en serie)
  const [marked, cleared] = await Promise.all([
    // Marcar como obsoletos solo los que aún no lo estaban (needsUpdate: false → true)
    staleIds.length > 0
      ? prisma.socialProfile.updateMany({
          where: { id: { in: staleIds }, needsUpdate: false },
          data:  { needsUpdate: true },
        })
      : { count: 0 },
    // Limpiar la marca de los que ya están al día (needsUpdate: true → false)
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
 * startCron — arranca el job periódico.
 * Se llama una vez desde index.js cuando el servidor está listo.
 */
export function startCron() {
  const run = async () => {
    try {
      console.log('[cron] Revisando perfiles desactualizados…');
      const { marked, cleared } = await runStaleCheck();
      console.log(`[cron] ✓ Marcados: ${marked} | Limpiados: ${cleared} | ${new Date().toISOString()}`);
    } catch (err) {
      // El error se loguea pero no mata el servidor
      console.error('[cron] ✗ Error en stale check:', err.message);
    }
  };

  run(); // Ejecución inmediata al arrancar el servidor

  // Ejecución periódica cada 24 horas
  const timer = setInterval(run, INTERVAL_MS);

  // unref(): si Express cierra, el timer no impedirá que el proceso termine
  timer.unref();

  console.log(`[cron] Stale check programado cada 24h (umbral: ${STALE_DAYS} días)`);
}
