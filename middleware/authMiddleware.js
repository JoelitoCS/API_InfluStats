import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

// Middleware que exige JWT y deja el usuario disponible en req.user.
export const protect = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || '';
        const [scheme, token] = authHeader.split(' ');

        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado: falta token'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Confirmamos que el usuario del token sigue existiendo.
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado: usuario no encontrado'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado: token invalido'
        });
    }
};
