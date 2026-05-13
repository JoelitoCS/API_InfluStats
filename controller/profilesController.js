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
