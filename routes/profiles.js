import express from 'express';
import { createProfile } from '../controller/profilesController.js';
import { protect } from '../middleware/authMiddleware.js';

// Router de perfiles sociales. Todas sus rutas requieren usuario autenticado.
const router = express.Router();

// Crea un perfil social asociado al usuario del token.
router.post('/', protect, createProfile);

export default router;
