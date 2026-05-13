import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

// ─────────────────────────────────────────────────────────────────
// Middleware "protect": exige JWT válido en todas las rutas de
// perfiles. Bloquea con 401 cualquier petición sin token o con
// token caducado/manipulado antes de llegar al controlador.
// ─────────────────────────────────────────────────────────────────
export const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    // Rechazamos si no viene el esquema Bearer o falta el token
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: falta token',
      });
    }

    // jwt.verify lanza error si el token está caducado o la firma no coincide
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Consultamos la BD para asegurarnos de que el usuario sigue existiendo.
    // Esto protege frente a tokens de usuarios eliminados.
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true }, // solo lo que necesitamos en req.user
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: usuario no encontrado',
      });
    }

    // Inyectamos el usuario en req para que los controladores lo usen
    // sin tener que volver a consultar la BD ellos mismos.
    req.user = user;
    next();
  } catch (error) {
    // Token inválido, expirado o manipulado → siempre 401
    return res.status(401).json({
      success: false,
      message: 'No autorizado: token inválido',
    });
  }
};