import express from 'express';
import {
  getUsers,
  deleteUser,
  getAllProfiles,
  deleteProfile,
  getMetricsByProfile,
  updateMetric,
  deleteMetric,
  deleteAllMetricsByProfile,
} from '../controller/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Todas las rutas de este router exigen: JWT válido + role='admin'
router.use(protect, isAdmin);

// ── Usuarios ──────────────────────────────────────────────────────────────────
router.get('/users',            getUsers);
router.delete('/users/:userId', deleteUser);

// ── Perfiles sociales ─────────────────────────────────────────────────────────
router.get('/profiles',               getAllProfiles);
router.delete('/profiles/:profileId', deleteProfile);

// ── Métricas ──────────────────────────────────────────────────────────────────
// ORDEN CRÍTICO: las rutas estáticas y con prefijo distinto van SIEMPRE antes
// de las dinámicas (:id), o Express las intercepta como si fueran un ID.

// Borrar TODAS las métricas de un perfil — prefijo /all-metrics/ para evitar
// colisión con DELETE /metrics/:metricsId
router.delete('/all-metrics/:profileId', deleteAllMetricsByProfile);

// Operaciones sobre un registro concreto
router.get('/metrics/:profileId',    getMetricsByProfile);
router.put('/metrics/:metricsId',    updateMetric);
router.delete('/metrics/:metricsId', deleteMetric);

export default router;
