import express from 'express';
import { createMetrics, getMetrics, getSummary, getStaleness, compareMetrics } from '../controller/metricsController.js';
import { protect }           from '../middleware/authMiddleware.js';

// Router independiente; se montará en /api/metrics en index.js.
const router = express.Router();

// GET /api/metrics/summary
// Resumen global de métricas actuales del usuario (última semana de cada perfil).
// IMPORTANTE: debe ir antes de /:profileId para que Express no lo interprete como un ID.
router.get('/summary',   protect, getSummary);
router.get('/staleness', protect, getStaleness);

// GET /api/metrics/compare/:profileId?period=1w
// Compara las métricas actuales con las de la semana anterior.
// IMPORTANTE: debe ir antes de /:profileId para que Express no confunda 'compare' con un ID.
router.get('/compare/:profileId', protect, compareMetrics);

// POST /api/metrics/:profileId
// Guarda las métricas semanales de un perfil del usuario autenticado.
// Flujo: protect (verifica JWT) → createMetrics (valida + inserta en BD)
router.post('/:profileId', protect, createMetrics);

// GET /api/metrics/:profileId
// Devuelve el historial completo de métricas de un perfil.
// Flujo: protect (verifica JWT) → getMetrics (verifica propiedad + devuelve datos)
router.get('/:profileId', protect, getMetrics);

export default router;
