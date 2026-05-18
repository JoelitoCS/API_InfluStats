import express from 'express';
import { createMetrics, getMetrics } from '../controller/metricsController.js';
import { protect }           from '../middleware/authMiddleware.js';

// Router independiente; se montará en /api/metrics en index.js.
const router = express.Router();

// POST /api/metrics/:profileId
// Guarda las métricas semanales de un perfil del usuario autenticado.
// Flujo: protect (verifica JWT) → createMetrics (valida + inserta en BD)
router.post('/:profileId', protect, createMetrics);

// GET /api/metrics/:profileId
// Devuelve el historial completo de métricas de un perfil.
// Flujo: protect (verifica JWT) → getMetrics (verifica propiedad + devuelve datos)
router.get('/:profileId', protect, getMetrics);

export default router;
