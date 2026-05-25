// Middleware adminMiddleware.js
// Debe usarse SIEMPRE después de `protect`, que ya carga req.user.
// Bloquea con 403 si el usuario autenticado no tiene role='admin'.

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Acceso denegado: se requiere rol de administrador',
    });
  }
  next();
};
