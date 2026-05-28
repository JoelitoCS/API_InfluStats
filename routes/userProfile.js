// ─────────────────────────────────────────────────────────────────────────────
//  routes/userProfile.js — Rutas del sistema de perfiles de usuario
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import {
  getMyProfile,
  upsertMyProfile,
  uploadMyAvatar,
  getPublicProfile,
  searchProfiles,
  exploreProfiles,
  upsertSocialLinks,
  deleteSocialLink,
} from '../controller/userProfileController.js';
import { protect }      from '../middleware/authMiddleware.js';
import { avatarUpload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// ── Rutas públicas / semi-públicas ────────────────────────────────────────────

// GET /api/user-profile/search?q=jo — búsqueda autocomplete (requiere auth)
router.get('/search', protect, searchProfiles);

// GET /api/user-profile/explore — usuarios recomendados (requiere auth)
router.get('/explore', protect, exploreProfiles);

// GET /api/user-profile/me — perfil propio completo
router.get('/me', protect, getMyProfile);

// PUT /api/user-profile/me — crear/editar perfil propio
router.put('/me', protect, upsertMyProfile);

// POST /api/user-profile/me/avatar — subir foto de perfil (Multer → Supabase)
router.post('/me/avatar', protect, avatarUpload, uploadMyAvatar);

// PUT /api/user-profile/me/social-links — gestionar redes sociales
router.put('/me/social-links', protect, upsertSocialLinks);

// DELETE /api/user-profile/me/social-links/:id — eliminar red social
router.delete('/me/social-links/:id', protect, deleteSocialLink);

// GET /api/user-profile/:username — perfil público de otro usuario
// IMPORTANTE: este va AL FINAL para que no capture /me, /search, /explore
router.get('/:username', protect, getPublicProfile);

export default router;
