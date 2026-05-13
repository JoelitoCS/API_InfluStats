import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────
// Middleware "validateOwnership": verifica que el perfil (:id)
// pertenece al usuario autenticado (req.user.id puesto por protect).
//
// Se coloca DESPUÉS de protect en la cadena de middlewares:
//   router.put('/:id', protect, validateOwnership, updateProfile)
//
// De esta forma, si el usuario intenta editar o eliminar un perfil
// que no es suyo recibe 403 antes de llegar al controlador.
// ─────────────────────────────────────────────────────────────────
export const validateOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Buscamos el perfil filtrando también por userId del token.
    // Si no existe O es de otro usuario, findFirst devuelve null.
    const profile = await prisma.socialProfile.findFirst({
      where: {
        id,
        userId: req.user.id, // clave: doble condición
      },
    });

    if (!profile) {
      // Respuesta intencionalmente genérica: no revelamos si el
      // perfil existe pero es de otro usuario (evita enumeración).
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este perfil',
      });
    }

    // Adjuntamos el perfil validado para no repetir la consulta
    // en el controlador posterior
    req.profile = profile;
    next();
  } catch (error) {
    console.error('Error en validación de propiedad:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al validar permisos',
    });
  }
};