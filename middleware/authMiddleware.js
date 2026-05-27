// ─────────────────────────────────────────────────────────────────────────────
//  middleware/authMiddleware.js — Middleware "protect"
//
//  Qué es un middleware en Express:
//    Una función que se ejecuta ENTRE que llega la petición y llega al
//    controlador. Recibe (req, res, next): si todo va bien llama a next()
//    para pasar al siguiente eslabón; si algo falla responde directamente
//    y corta la cadena (no llama a next).
//
//  Qué hace "protect":
//    1. Lee el header Authorization: Bearer <token>
//    2. Verifica la firma y expiración del token con jwt.verify()
//    3. Busca el usuario en la BD (para detectar cuentas eliminadas)
//    4. Inyecta req.user = { id, email, role } para que el controlador lo use
//
//  Dónde se usa:
//    En todos los routers excepto /api/auth/register y /api/auth/login.
//    Ejemplo: router.get('/', protect, getProfiles)
// ─────────────────────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

export const protect = async (req, res, next) => {
  try {
    // El header debe llegar como: Authorization: Bearer eyJhbGci...
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    // Rechazamos si no viene el esquema "Bearer" o falta el token después
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: falta token',
      });
    }

    // jwt.verify() hace dos cosas a la vez:
    //   1. Comprueba que la firma sea válida (nadie ha manipulado el token)
    //   2. Comprueba que el token no haya expirado (expiresIn: '30d')
    // Si falla por cualquier motivo lanza una excepción → vamos al catch.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Buscamos el usuario en la BD para garantizar que sigue existiendo.
    // Sin esto un token de un usuario eliminado seguiría funcionando 30 días.
    const user = await prisma.user.findUnique({
      where:  { id: decoded.id },
      select: { id: true, email: true, role: true }, // role necesario para isAdmin
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: usuario no encontrado',
      });
    }

    // req.user queda disponible en todos los controladores que vengan después.
    // Los controladores acceden a req.user.id para filtrar datos por usuario.
    req.user = user;
    next(); // Continuar al siguiente middleware o al controlador
  } catch (error) {
    // jwt.verify lanza JsonWebTokenError o TokenExpiredError → siempre 401
    return res.status(401).json({
      success: false,
      message: 'No autorizado: token inválido',
    });
  }
};
