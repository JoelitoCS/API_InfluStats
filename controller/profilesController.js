import { prisma } from '../lib/prisma.js';

// Plataformas validas segun el CHECK real de Supabase: youtube, tiktok, instagram y twitch.
const VALID_PLATFORMS = ['youtube', 'tiktok', 'instagram', 'twitch'];

// Comprueba que la URL sea http o https y tenga hostname real.
const isValidUrl = (value) => {
    try {
        const parsedUrl = new URL(value);
        return ['http:', 'https:'].includes(parsedUrl.protocol) && Boolean(parsedUrl.hostname);
    } catch {
        return false;
    }
};

// Normaliza la plataforma al formato que acepta la tabla: texto en minusculas.
const normalizePlatform = (platform) => {
    return String(platform || '').trim().toLowerCase();
};

// Crea un perfil social para el usuario autenticado.
export const createProfile = async (req, res) => {
    try {
        const { name, url, platform } = req.body;
        const normalizedPlatform = normalizePlatform(platform);

        if (!name || !url || !platform) {
            return res.status(400).json({
                success: false,
                message: 'Nombre, URL y plataforma son obligatorios'
            });
        }

        if (!VALID_PLATFORMS.includes(normalizedPlatform)) {
            return res.status(400).json({
                success: false,
                message: 'Plataforma no valida'
            });
        }

        if (!isValidUrl(url)) {
            return res.status(400).json({
                success: false,
                message: 'La URL debe ser real y empezar por http:// o https://'
            });
        }

        // Evita duplicados por plataforma dentro del mismo usuario.
        const existingProfile = await prisma.socialProfile.findFirst({
            where: {
                userId: req.user.id,
                platform: normalizedPlatform
            }
        });

        if (existingProfile) {
            return res.status(409).json({
                success: false,
                message: 'Ya existe un perfil para esta plataforma'
            });
        }

        const profile = await prisma.socialProfile.create({
            data: {
                username: String(name).trim(),
                url: String(url).trim(),
                platform: normalizedPlatform,
                userId: req.user.id
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
            error: error.message
        });
    }
};

export const getProfiles = async (req, res) => {
  try {
    // Filtramos estrictamente por el id del usuario que lleva el JWT,
    // así cada usuario solo ve sus propios perfiles.
    const profiles = await prisma.socialProfile.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' }, // más nuevo primero
    });

    return res.status(200).json({
      success: true,
      profiles, // array vacío [] si el usuario no tiene perfiles aún
    });
  } catch (error) {
    console.error('Error al obtener perfiles:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener perfiles',
      error: error.message,
    });
  }
};


// Solo puede editarlo el usuario propietario (validado en el
// middleware protect + comprobación de userId aquí abajo).

export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params; // id del perfil a editar
    const { name, url, platform } = req.body;

    // Comprobamos que se envía al menos un campo con datos
    if (!name && !url && !platform) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar al menos un campo para actualizar',
      });
    }

    // Verificamos que el perfil existe Y pertenece al usuario del JWT.
    // Si no lo encontramos así, devolvemos 404 (no revelamos si existe
    // pero es de otro usuario, por seguridad).
    const existing = await prisma.socialProfile.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Perfil no encontrado',
      });
    }

    // Construimos solo los campos que llegan en el body.
    // Así podemos hacer actualizaciones parciales (solo URL, por ejemplo).
    const dataToUpdate = {};
    if (name)     dataToUpdate.username = String(name).trim();
    if (url)      dataToUpdate.url      = String(url).trim();
    if (platform) {
      const normalizedPlatform = normalizePlatform(platform);
      // Reutilizamos la misma validación de plataformas que en create
      if (!VALID_PLATFORMS.includes(normalizedPlatform)) {
        return res.status(400).json({
          success: false,
          message: 'Plataforma no válida',
        });
      }
      dataToUpdate.platform = normalizedPlatform;
    }

    // Validamos la URL si viene en el body
    if (url && !isValidUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'La URL debe ser real y empezar por http:// o https://',
      });
    }

    // Ejecutamos el UPDATE en PostgreSQL via Prisma
    const updated = await prisma.socialProfile.update({
      where: { id },
      data: dataToUpdate,
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
      error: error.message,
    });
  }
};
