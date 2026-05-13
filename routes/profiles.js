import express from 'express';
import {
  createProfile,
  getProfiles,
  updateProfile,   // nuevo endpoint de edición
} from '../controller/profilesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET  /api/profiles      →  listar perfiles del usuario
router.get('/',    protect, getProfiles);

// POST /api/profiles      →  crear perfil nuevo
router.post('/',   protect, createProfile);

// PUT  /api/profiles/:id  →  editar un perfil existente
// :id es el uuid del perfil en la tabla social_profiles
router.put('/:id', protect, updateProfile);

export default router;