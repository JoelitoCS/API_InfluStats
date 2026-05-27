// ─────────────────────────────────────────────────────────────────────────────
//  controller/authController.js — Registro y login de usuarios
//
//  Funciones exportadas:
//    register → POST /api/auth/register
//    login    → POST /api/auth/login
//
//  Tecnologías clave:
//    bcryptjs   — hash de contraseñas (nunca se guarda la contraseña en texto plano)
//    jsonwebtoken (jwt) — genera el token que el frontend guardará en localStorage
//    prisma     — consultas a la tabla 'users' de Supabase
// ─────────────────────────────────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

// ── generateToken ─────────────────────────────────────────────────────────────
// Crea un JWT firmado con el id del usuario.
// El frontend lo recibirá y lo guardará en localStorage bajo la clave 'token'.
// En cada petición protegida lo enviará como: Authorization: Bearer <token>
// expiresIn: '30d' → el token caduca pasados 30 días, el usuario deberá re-loguearse.
const generateToken = (id) => {
  return jwt.sign(
    { id },                        // Payload: solo el id del usuario
    process.env.JWT_SECRET,        // Clave secreta (en .env)
    { expiresIn: '30d' }           // Duración del token
  );
};

// ── register ──────────────────────────────────────────────────────────────────
// Crea un usuario nuevo tras validar todos los campos.
// Responde 201 con el token si todo va bien.
export const register = async (req, res) => {
  try {
    const { email, password, passwordConfirm } = req.body;

    // ── Validaciones de campos vacíos ─────────────────────────────────────────
    if (!email || !password || !passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona email y contrasena'
      });
    }

    // Las contraseñas deben coincidir (doble comprobación cliente + servidor)
    if (password !== passwordConfirm) {
      return res.status(400).json({
        success: false,
        message: 'Las contrasenas no coinciden'
      });
    }

    // ── Validación de formato de email con regex ───────────────────────────────
    // El regex exige: algo@algo.dominio (2-3 letras de extensión)
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona un email valido'
      });
    }

    // ── Validaciones de seguridad de contraseña ───────────────────────────────
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contrasena debe tener minimo 8 caracteres'
      });
    }

    // Regex de contraseña fuerte: al menos una mayúscula, una minúscula y un dígito
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'La contrasena debe contener mayusculas, minusculas y numeros'
      });
    }

    // Normalizamos el email a minúsculas para evitar duplicados case-sensitive
    const emailLowercase = email.toLowerCase();

    // ── Comprobación de email único ───────────────────────────────────────────
    // Buscamos primero en la BD antes de intentar crear.
    // Si ya existe respondemos 400 (mejor que dejar que falle el UNIQUE de la BD).
    const userExistente = await prisma.user.findUnique({
      where: { email: emailLowercase }
    });
    if (userExistente) {
      return res.status(400).json({
        success: false,
        message: 'El email ya esta registrado'
      });
    }

    // ── Hash de la contraseña ─────────────────────────────────────────────────
    // bcrypt.genSalt(10): genera una "sal" aleatoria de 10 rondas.
    // Más rondas = más seguro pero más lento. 10 es el estándar recomendado.
    // bcrypt.hash(): combina la contraseña con la sal y genera el hash.
    // El hash es el único dato que se guarda en la BD.
    const salt = await bcrypt.genSalt(10);
    const passwordEncriptada = await bcrypt.hash(password, salt);

    // ── Crear el usuario en la BD ─────────────────────────────────────────────
    const usuario = await prisma.user.create({
      data: {
        email:        emailLowercase,
        passwordHash: passwordEncriptada  // Campo en la BD: password_hash
      }
    });

    // Generamos el token con el id del nuevo usuario
    const token = generateToken(usuario.id);

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      token,
      usuario: {
        id:        usuario.id,
        email:     usuario.email,
        createdAt: usuario.createdAt
      }
    });

  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario',
      error:   error.message
    });
  }
};

// ── login ─────────────────────────────────────────────────────────────────────
// Valida email + contraseña y devuelve un JWT si las credenciales son correctas.
// También actualiza lastLogin para que el admin pueda ver cuándo entró el usuario.
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Por favor proporciona email y contrasena'
      });
    }

    // Buscamos el usuario por email (en minúsculas, como se guardó al registrar)
    const usuario = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Seguridad: si el email no existe, respondemos igual que si la contraseña
    // fuera incorrecta. No revelamos qué campo está mal (evita enumeración de cuentas).
    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Email o contrasena incorrectos'
      });
    }

    // bcrypt.compare() compara la contraseña recibida contra el hash guardado.
    // Internamente vuelve a aplicar la misma sal que usó el hash original.
    const esValida = await bcrypt.compare(password, usuario.passwordHash);

    if (!esValida) {
      return res.status(401).json({
        success: false,
        message: 'Email o contrasena incorrectos'
      });
    }

    // Generamos un nuevo token en cada login (token fresco con 30 días nuevos)
    const token = generateToken(usuario.id);

    // Actualizamos lastLogin para el panel de admin
    await prisma.user.update({
      where: { id: usuario.id },
      data:  { lastLogin: new Date() }
    });

    res.status(200).json({
      success: true,
      message: 'Login exitoso',
      token,
      usuario: {
        id:    usuario.id,
        email: usuario.email,
        role:  usuario.role,  // El frontend lo guarda en localStorage para mostrar/ocultar admin
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesion',
      error:   error.message
    });
  }
};
