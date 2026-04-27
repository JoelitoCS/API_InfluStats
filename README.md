# InfluStats API - Documentación de Registro

## Resumen de implementación

Se ha implementado un sistema completo de registro de usuarios con validaciones, encriptación de contraseñas y generación de tokens JWT.

## 📋 Validaciones implementadas

### Email
- ✓ Validación de formato (debe ser email válido)
- ✓ Unicidad en base de datos
- ✓ Se convierte a minúsculas automáticamente

### Contraseña
- ✓ Mínimo 8 caracteres
- ✓ Debe contener mayúsculas
- ✓ Debe contener minúsculas
- ✓ Debe contener números
- ✓ Encriptación con bcryptjs (salt rounds: 10)

### Datos
- ✓ Se guardan correctamente en MongoDB
- ✓ Timestamp automático de creación
- ✓ Password nunca se retorna en respuestas

## 🔗 Endpoints

### POST /api/auth/register
Registra un nuevo usuario

**Payload:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Password123",
  "passwordConfirm": "Password123"
}
```

**Respuesta exitosa (201):**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "507f1f77bcf86cd799439011",
    "email": "usuario@ejemplo.com",
    "createdAt": "2026-04-27T10:30:00.000Z"
  }
}
```

**Respuesta con error (400/500):**
```json
{
  "success": false,
  "message": "El email ya está registrado"
}
```

### POST /api/auth/login
Inicia sesión con un usuario existente

**Payload:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Password123"
}
```

**Respuesta exitosa (200):**
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": "507f1f77bcf86cd799439011",
    "email": "usuario@ejemplo.com"
  }
}
```

## 📦 Estructura de carpetas

```
API_InfluStats/
├── models/
│   └── User.js              # Modelo de usuario con validaciones
├── controller/
│   └── authController.js    # Lógica de registro y login
├── routes/
│   └── auth.js              # Rutas de autenticación
├── public/
│   ├── index.html           # Formulario de registro frontend
│   └── app.js               # Lógica frontend
├── index.js                 # Archivo principal
├── .env                     # Variables de entorno
└── requests.http            # Pruebas de API
```

## 🚀 Cómo ejecutar

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar MongoDB
- Asegúrate de tener MongoDB corriendo localmente (por defecto en mongodb://localhost:27017)
- O actualiza la variable MONGODB_URI en `.env` con tu conexión

### 3. Iniciar el servidor
```bash
npm run dev     # Desarrollo con nodemon
npm start       # Producción
```

El servidor estará disponible en: `http://localhost:3000`

## 🧪 Pruebas

### Opción 1: Frontend (Recomendado)
1. Abre tu navegador en `http://localhost:3000`
2. Completa el formulario de registro
3. Observa las validaciones en tiempo real
4. El token JWT se mostrará después del registro exitoso

### Opción 2: REST Client (en VS Code)
1. Instala la extensión "REST Client" en VS Code
2. Abre el archivo `requests.http`
3. Haz clic en "Send Request" en cada sección

### Opción 3: Postman
1. Importa las solicitudes desde `requests.http`
2. O crea manualmente:
   - POST http://localhost:3000/api/auth/register
   - POST http://localhost:3000/api/auth/login

## 🔐 Seguridad

- ✓ Contraseñas encriptadas con bcryptjs
- ✓ JWT para autenticación stateless
- ✓ CORS habilitado
- ✓ Validaciones en cliente y servidor
- ✓ Manejo seguro de errores
- ✓ Tokens con expiración (30 días)

## 📝 Variables de entorno (.env)

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/influStats
JWT_SECRET=tu_clave_secreta_super_segura_2026_cambiar_en_produccion
ENVIRONMENT=development
```

## ⚠️ Notas importantes

1. **JWT_SECRET**: Cambiar en producción a una clave más segura
2. **MONGODB_URI**: Configurar conexión a tu BD (Atlas, local, etc.)
3. **CORS**: Actualmente permite todas las origins (configurar en producción)
4. **Email duplicado**: Si intentas registrar el mismo email 2 veces, obtendrás error 400

## 🚀 Próximos pasos

- Implementar endpoint de login
- Crear middleware de autenticación (proteger rutas)
- Implementar recuperación de contraseña
- Agregar roles y permisos
- Implementar dashboard
- Gestión de perfiles sociales

## 📞 Soporte

Para más información sobre las tecnologías utilizadas:
- Express.js: https://expressjs.com/
- Mongoose: https://mongoosejs.com/
- JWT: https://jwt.io/
- bcryptjs: https://github.com/dcodeIO/bcrypt.js
