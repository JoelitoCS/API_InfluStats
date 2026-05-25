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
// IMPORTANTE: la ruta estática /metrics/profile/:profileId/all debe ir
// ANTES de /metrics/:metricsId para que Express no confunda "profile" con un ID.
router.get('/metrics/:profileId',                getMetricsByProfile);
router.put('/metrics/:metricsId',                updateMetric);
router.delete('/metrics/:metricsId',             deleteMetric);
router.delete('/metrics/profile/:profileId/all', deleteAllMetricsByProfile);

export default router;
