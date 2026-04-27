import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Generar JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d'
    });
};

// @desc    Registrar usuario
// @route   POST /auth/register
// @access  Public
export const register = async (req, res) => {
    try {
        const { email, password, passwordConfirm } = req.body;

        // Validaciones básicas
        if (!email || !password || !passwordConfirm) {
            return res.status(400).json({
                success: false,
                message: 'Por favor proporciona email y contraseña'
            });
        }

        // Validar que las contraseñas coincidan
        if (password !== passwordConfirm) {
            return res.status(400).json({
                success: false,
                message: 'Las contraseñas no coinciden'
            });
        }

        // Validar formato de email
        const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Por favor proporciona un email válido'
            });
        }

        // Validar requisitos mínimos de contraseña
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe tener mínimo 8 caracteres'
            });
        }

        // Validar que la contraseña tenga mayúsculas, minúsculas y números
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'La contraseña debe contener mayúsculas, minúsculas y números'
            });
        }

        // Convertir email a minúsculas
        const emailLowercase = email.toLowerCase();

        // Verificar si el email ya existe
        const userExistente = await prisma.user.findUnique({
            where: { email: emailLowercase }
        });

        if (userExistente) {
            return res.status(400).json({
                success: false,
                message: 'El email ya está registrado'
            });
        }

        // Encriptar contraseña
        const salt = await bcrypt.genSalt(10);
        const passwordEncriptada = await bcrypt.hash(password, salt);

        // Crear nuevo usuario
        const usuario = await prisma.user.create({
            data: {
                email: emailLowercase,
                password: passwordEncriptada
            }
        });

        // Generar token
        const token = generateToken(usuario.id);

        // Respuesta exitosa
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

// @desc    Login usuario
// @route   POST /auth/login
// @access  Public
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validaciones
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor proporciona email y contraseña'
            });
        }

        // Buscar usuario
        const usuario = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        
        if (!usuario) {
            return res.status(401).json({
                success: false,
                message: 'Email o contraseña incorrectos'
            });
        }

        // Verificar contraseña
        const esValida = await bcrypt.compare(password, usuario.password);
        
        if (!esValida) {
            return res.status(401).json({
                success: false,
                message: 'Email o contraseña incorrectos'
            });
        }

        // Generar token
        const token = generateToken(usuario.id);

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
            message: 'Error al iniciar sesión',
            error: error.message
        });
    }
};
