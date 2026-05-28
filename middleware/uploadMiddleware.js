// ─────────────────────────────────────────────────────────────────────────────
//  middleware/uploadMiddleware.js — Multer para foto de perfil
//
//  Arquitectura: Frontend → POST /api/user-profile/avatar → Multer (aquí)
//                → supabaseStorage.uploadAvatar() → Supabase Storage
//
//  Decisiones de diseño:
//    - diskStorage en /tmp: el archivo NO va a memoria (evita OOM con imágenes)
//    - Validación de tipo por MIME (no solo extensión) para evitar spoofing
//    - Tamaño máximo: 5 MB
//    - El nombre del archivo en disco usa UUID para evitar colisiones
//    - Después de subir a Supabase, el archivo temporal se borra
// ─────────────────────────────────────────────────────────────────────────────

import multer    from 'multer';
import path      from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

// Extensiones permitidas (doble validación)
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

// Tamaño máximo: 5 MB
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// ── Storage: disco temporal ───────────────────────────────────────────────────
// Multer guarda el archivo en /tmp con nombre único (UUID) para evitar
// colisiones si hay peticiones simultáneas.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir()); // /tmp en Linux/Mac, %TEMP% en Windows
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${uuidv4()}${ext}`);
  },
});

// ── fileFilter: validación por MIME type ─────────────────────────────────────
// Se ejecuta ANTES de que Multer escriba el archivo.
// Si el MIME type no está en la whitelist → error inmediato.
const fileFilter = (_req, file, cb) => {
  // Validar MIME type
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      Object.assign(new Error('Tipo de archivo no permitido. Solo JPG, PNG o WebP.'), { code: 'INVALID_MIME' }),
      false
    );
  }

  // Validar extensión
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return cb(
      Object.assign(new Error('Extensión no permitida. Solo .jpg, .jpeg, .png, .webp'), { code: 'INVALID_EXT' }),
      false
    );
  }

  cb(null, true); // Aceptar el archivo
};

// ── Instancia Multer ──────────────────────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize:  MAX_SIZE_BYTES,
    files:     1,             // Solo un archivo por petición
    fields:    5,             // Máximo 5 campos de texto adicionales
  },
});

// ── avatarUpload ──────────────────────────────────────────────────────────────
// Middleware listo para usar en el router:
//   router.post('/avatar', protect, avatarUpload, uploadAvatarController)
//
// Maneja los errores de Multer de forma descriptiva para el cliente.
export const avatarUpload = (req, res, next) => {
  const multerSingle = upload.single('avatar'); // field name esperado en el form

  multerSingle(req, res, (err) => {
    if (!err) return next();

    // Errores de Multer
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'El archivo es demasiado grande. Máximo 5 MB.',
      });
    }

    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Campo de archivo inesperado. Usa el campo "avatar".',
      });
    }

    if (err.code === 'INVALID_MIME' || err.code === 'INVALID_EXT') {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Error genérico
    console.error('Multer error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar el archivo.',
    });
  });
};
