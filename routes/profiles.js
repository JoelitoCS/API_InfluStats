import express from 'express';
import {
  createProfile,
  getProfiles,
  updateProfile,
} from '../controller/profilesController.js';
import { protect }            from '../middleware/authMiddleware.js';
import { validateOwnership }  from '../middleware/ownershipMiddleware.js';

const router = express.Router();

// GET  /api/profiles
// Solo requiere estar autenticado; filtra por userId en el controlador
router.get('/', protect, getProfiles);

// POST /api/profiles
// Solo autenticación; el userId viene de req.user, no del body
router.post('/', protect, createProfile);

// PUT  /api/profiles/:id
// protect  → valida JWT y carga req.user
// validateOwnership → confirma que el perfil es del usuario antes de editar
router.put('/:id', protect, validateOwnership, updateProfile);

export default router;