// ─────────────────────────────────────────────────────────────────────────────
//  controller/profilesController.js — CRUD de perfiles sociales
//
//  Funciones exportadas:
//    createProfile → POST /api/profiles
//    getProfiles   → GET  /api/profiles
//    updateProfile → PUT  /api/profiles/:id
//
//  Todas requieren autenticación (middleware protect antes de llegar aquí).
//  El userId del usuario autenticado se lee de req.user.id (puesto por protect).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma.js';

// Plataformas válidas según el CHECK de la tabla social_profiles en Supabase.
// Cambiar aquí si se añade una nueva plataforma (y actualizar el schema de Prisma).
const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitch'];

// ── isValidUrl ────────────────────────────────────────────────────────────────
// Usa el constructor nativo URL() para validar la URL.
// Si el string no es una URL válida, new URL() lanza una excepción → return false.
// También exige que el protocolo sea http o https (no acepta ftp://, etc.).
const isValidUrl = (value) => {
  try {
    const parsedUrl = new URL(value);
    return ['http:', 'https:'].includes(parsedUrl.protocol) && Boolean(parsedUrl.hostname);
  } catch {
    return false;
  }
};

// ── normalizePlatform ─────────────────────────────────────────────────────────
// Convierte "INSTAGRAM", "Instagram", etc. a "instagram".
// Así el usuario puede enviar la plataforma en cualquier capitalización.
const normalizePlatform = (platform) => {
  return String(platform || '').trim().toLowerCase();
};

// ── createProfile ─────────────────────────────────────────────────────────────
// Crea un nuevo perfil social asociado al usuario autenticado.
// Un usuario puede tener varios perfiles PERO no dos con el mismo username + plataforma.
export const createProfile = async (req, res) => {
  try {
    const { name, url, platform } = req.body;
    const normalizedPlatform = normalizePlatform(platform);

    // Validar presencia de todos los campos obligatorios
    if (!name || !url || !platform) {
      return res.status(400).json({
        success: false,
        message: 'Nombre, URL y plataforma son obligatorios'
      });
    }

    // Validar que la plataforma sea una de las 4 permitidas
    if (!VALID_PLATFORMS.includes(normalizedPlatform)) {
      return res.status(400).json({
        success: false,
        message: 'Plataforma no valida'
      });
    }

    // Validar que la URL sea real (no solo un texto cualquiera)
    if (!isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'La URL debe ser real y empezar por http:// o https://'
      });
    }

    // Comprobar duplicado: mismo username + misma plataforma para este usuario.
    // El mismo nombre en plataformas distintas SÍ está permitido.
    const existingProfile = await prisma.socialProfile.findFirst({
      where: {
        userId:   req.user.id,           // Solo buscamos entre los perfiles del usuario
        platform: normalizedPlatform,
        username: String(name).trim(),
      }
    });

    if (existingProfile) {
      return res.status(409).json({                  // 409 Conflict
        success: false,
        message: `Ya tienes un perfil llamado "${String(name).trim()}" en ${normalizedPlatform}`,
      });
    }

    // Crear el perfil en la BD
    const profile = await prisma.socialProfile.create({
      data: {
        username: String(name).trim(),
        url:      String(url).trim(),
        platform: normalizedPlatform,
        userId:   req.user.id            // FK a la tabla users
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Perfil social creado correctamente',
      profile
    });

  } catch (error) {
    console.error('Error al crear perfil social:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al crear perfil social',
      error:   error.message
    });
  }
};

// ── getProfiles ───────────────────────────────────────────────────────────────
// Devuelve todos los perfiles del usuario autenticado, ordenados por fecha desc.
// Cada usuario solo ve sus propios perfiles (filtramos por req.user.id).
export const getProfiles = async (req, res) => {
  try {
    const profiles = await prisma.socialProfile.findMany({
      where:   { userId: req.user.id },    // Solo los perfiles de este usuario
      orderBy: { createdAt: 'desc' },      // El más nuevo primero
    });

    return res.status(200).json({
      success:  true,
      profiles,                            // Array vacío [] si no tiene perfiles
    });

  } catch (error) {
    console.error('Error al obtener perfiles:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfiles',
      error:   error.message,
    });
  }
};

// ── updateProfile ─────────────────────────────────────────────────────────────
// Actualización parcial: solo se actualizan los campos que llegan en el body.
// El middleware validateOwnership ya comprobó la propiedad antes de llegar aquí.
export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;              // UUID del perfil a editar
    const { name, url, platform } = req.body;

    // Exigir al menos un campo en el body
    if (!name && !url && !platform) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar al menos un campo para actualizar',
      });
    }

    // Re-verificar propiedad (defensa en profundidad, aunque validateOwnership ya lo hizo)
    const existing = await prisma.socialProfile.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Perfil no encontrado' });
    }

    // Construir objeto con solo los campos recibidos (actualización parcial)
    const dataToUpdate = {};
    if (name)     dataToUpdate.username = String(name).trim();
    if (url)      dataToUpdate.url      = String(url).trim();
    if (platform) {
      const normalizedPlatform = normalizePlatform(platform);
      if (!VALID_PLATFORMS.includes(normalizedPlatform)) {
        return res.status(400).json({ success: false, message: 'Plataforma no válida' });
      }
      dataToUpdate.platform = normalizedPlatform;
    }

    // Validar URL solo si viene en el body
    if (url && !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'La URL debe ser real y empezar por http:// o https://',
      });
    }

    // Comprobar que el nuevo username+platform no duplique otro perfil existente.
    // Usamos los valores finales (nuevo si llega en body, actual si no).
    const finalUsername = dataToUpdate.username ?? existing.username;
    const finalPlatform = dataToUpdate.platform ?? existing.platform;
    const duplicate = await prisma.socialProfile.findFirst({
      where: {
        userId:   req.user.id,
        username: finalUsername,
        platform: finalPlatform,
        id:       { not: existing.id },   // Excluir el propio perfil que se edita
      },
    });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Ya tienes un perfil llamado "${finalUsername}" en ${finalPlatform}`,
      });
    }

    // Ejecutar el UPDATE en PostgreSQL
    const updated = await prisma.socialProfile.update({
      where: { id },
      data:  dataToUpdate,
    });

    return res.status(200).json({
      success: true,
      message: 'Perfil actualizado correctamente',
      profile: updated,
    });

  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error:   error.message,
    });
  }
};
