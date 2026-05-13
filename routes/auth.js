import express from 'express';
import { register, login } from '../controller/authController.js';

// Router pequeno dedicado a autenticacion.
const router = express.Router();

// Crea un usuario nuevo y devuelve JWT.
router.post('/register', register);

// Valida credenciales existentes y devuelve JWT.
router.post('/login', login);

export default router;
