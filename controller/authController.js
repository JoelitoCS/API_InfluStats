import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

// Firma un JWT con el id del usuario para futuras rutas protegidas.
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// Registra un usuario nuevo validando email y reglas de contrasena.
export const register = async (req, res) => {
    try {
        const { email, password, passwordConfirm } = req.body;

        if (!email || !password || !passwordConfirm) {
            return res.status(400).json({
                success: false,
                message: 'Por favor proporciona email y contrasena'
            });
        }

        if (password !== passwordConfirm) {
            return res.status(400).json({
                success: false,
                message: 'Las contrasenas no coinciden'
            });
        }

        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Por favor proporciona un email valido'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'La contrasena debe tener minimo 8 caracteres'
            });
        }

        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'La contrasena debe contener mayusculas, minusculas y numeros'
            });
        }

        const emailLowercase = email.toLowerCase();

        // Evita duplicados antes de intentar crear el registro.
        const userExistente = await prisma.user.findUnique({
            where: { email: emailLowercase }
        });

        if (userExistente) {
            return res.status(400).json({
                success: false,
                message: 'El email ya esta registrado'
            });
        }

        // Nunca guardamos la contrasena plana, solo su hash.
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        const usuario = await prisma.user.create({
            data: {
                email: emailLowercase,
                passwordHash: passwordEncriptada
            }
        });

        const token = generateToken(usuario.id);

        res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email,
                createdAt: usuario.createdAt
            }
        });
    } catch (error) {
        console.error('Error en registro:', error);

        res.status(500).json({
            success: false,
            message: 'Error al registrar usuario',
            error: error.message
        });
    }
};

// Inicia sesion comparando la contrasena recibida con el hash guardado.
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor proporciona email y contrasena'
            });
        }

        const usuario = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });

        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Email o contrasena incorrectos'
            });
        }

        const esValida = await bcrypt.compare(password, usuario.passwordHash);

        if (!esValida) {
            return res.status(401).json({
                success: false,
                message: 'Email o contrasena incorrectos'
            });
        }

        const token = generateToken(usuario.id);

        // Actualiza la fecha del ultimo acceso en la columna real last_login.
        await prisma.user.update({
            where: { id: usuario.id },
            data: { lastLogin: new Date() }
        });

        res.status(200).json({
            success: true,
            message: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                email: usuario.email
            }
        });
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar sesion',
            error: error.message
        });
    }
};
