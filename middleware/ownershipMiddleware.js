// ─────────────────────────────────────────────────────────────────────────────
//  middleware/ownershipMiddleware.js — Middleware "validateOwnership"
//
//  Qué hace:
//    Comprueba que el perfil indicado en :id pertenece al usuario autenticado.
//    Si no coincide, devuelve 403 antes de que el controlador haga nada.
//
//  Dónde se coloca en la cadena:
//    SIEMPRE después de protect, porque necesita que req.user ya exista:
//      router.put('/:id', protect, validateOwnership, updateProfile)
//
//  Por qué la respuesta es genérica ("No tienes permiso"):
//    No revelamos si el perfil existe pero es de otro usuario.
//    Si dijéramos "ese perfil existe pero no es tuyo", estaríamos dando
//    información útil a un atacante que intente enumerar perfiles ajenos.
//
//  req.profile:
//    Al terminar adjuntamos el perfil validado en req.profile para que
//    el controlador no tenga que repetir la misma consulta a la BD.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma.js';

export const validateOwnership = async (req, res, next) => {
  try {
    const { id } = req.params; // id del perfil que viene en la URL

    // findFirst con doble condición: el perfil debe existir Y pertenecer al usuario.
    // Si el perfil existe pero es de otro → findFirst devuelve null → 403.
    const profile = await prisma.socialProfile.findFirst({
      where: {
        id,
        userId: req.user.id, // req.user lo puso el middleware protect anterior
      },
    });

    if (!profile) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para acceder a este perfil',
      });
    }

    // Guardamos el perfil en req para que el controlador lo use sin nueva consulta
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
