# 🔄 Resumen: Migración de MongoDB a Supabase

## ¿Qué cambió?

### Antes (MongoDB + Mongoose)
```javascript
// models/User.js
const userSchema = new mongoose.Schema({
    email: String,
    password: String
});

// controller/authController.js
const usuario = await User.create({...});
```

### Ahora (PostgreSQL + Prisma)
```javascript
// prisma/schema.prisma
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  password String
}

// controller/authController.js
const usuario = await prisma.user.create({...});
```

---

## 📊 Comparación

| Aspecto | MongoDB | PostgreSQL (Supabase) |
|---------|---------|------------------------|
| **Tipo** | NoSQL (documentos) | SQL (relaciones) |
| **ORM** | Mongoose | Prisma |
| **Host** | Local/Atlas | Supabase (gratis) |
| **Validaciones** | Schema | Prisma Schema |
| **Relaciones** | Débiles | Fuertes |
| **SQL** | No | Sí |

---

## 🔧 Lo que se reemplazó

### 1. Conexión a BD

**Antes:**
```javascript
import mongoose from 'mongoose';
const MONGODB_URI = process.env.MONGODB_URI;
mongoose.connect(MONGODB_URI);
```

**Ahora:**
```javascript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
await prisma.$queryRaw`SELECT 1`; // Verifica conexión
```

### 2. Modelo User

**Antes:**
```javascript
// models/User.js (Mongoose)
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    password: { type: String, select: false },
    createdAt: { type: Date, default: Date.now }
});
```

**Ahora:**
```prisma
// prisma/schema.prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

### 3. Crear usuario

**Antes:**
```javascript
const usuario = await User.create({
    email: emailLowercase,
    password: passwordEncriptada
});
```

**Ahora:**
```javascript
const usuario = await prisma.user.create({
    data: {
        email: emailLowercase,
        password: passwordEncriptada
    }
});
```

### 4. Buscar usuario

**Antes:**
```javascript
const user = await User.findOne({ email: emailLowercase });
```

**Ahora:**
```javascript
const user = await prisma.user.findUnique({
    where: { email: emailLowercase }
});
```

### 5. Comparar contraseña

**Antes:**
```javascript
const esValida = await usuario.matchPassword(password);
// Método definido en schema: userSchema.methods.matchPassword
```

**Ahora:**
```javascript
const esValida = await bcrypt.compare(password, usuario.password);
// Usando bcryptjs directamente
```

---

## 🚀 Pasos para empezar

### 1. Configura Supabase
```
Ve a https://supabase.com
Crea proyecto
Copia DATABASE_URL
```

### 2. Actualiza .env
```env
DATABASE_URL="postgresql://...tu_url..."
```

### 3. Migra la BD
```bash
npm run prisma:migrate
```

### 4. Inicia servidor
```bash
npm run dev
```

---

## 📋 Variables de entorno

### Antes
```env
MONGODB_URI=mongodb://...
```

### Ahora
```env
DATABASE_URL=postgresql://...
```

---

## 🧪 Scripts nuevos

```bash
# Ver datos en interfaz gráfica
npm run prisma:studio

# Ejecutar migraciones
npm run prisma:migrate

# Generar cliente de Prisma
npm run prisma:generate
```

---

## ⚠️ Qué NO cambió

✅ **Validaciones** - Siguen siendo iguales
✅ **Endpoints API** - `/api/auth/register`, `/api/auth/login`
✅ **Responses** - Mismos formatos JSON
✅ **Frontend** - Funciona igual
✅ **JWT** - Mismo sistema
✅ **Encriptación** - Mismo bcryptjs

---

## 🔐 Seguridad

✅ Contraseñas encriptadas
✅ Email único garantizado por DB
✅ JWT tokens de 30 días
✅ Validaciones dobles

---

## 📚 Próximas migraciones (si necesitas más tablas)

Para agregar nuevas tablas a Prisma:

1. Edita `prisma/schema.prisma`
2. Ejecuta `npm run prisma:migrate`
3. Nombra la migración

Ejemplo:
```prisma
model Post {
  id        Int     @id @default(autoincrement())
  title     String
  userId    Int
  user      User    @relation(fields: [userId], references: [id])
}
```

---

## 🎉 Migración completada

Tu proyecto ahora usa:
- ✅ Supabase (PostgreSQL)
- ✅ Prisma ORM
- ✅ Todas las validaciones mantidas
- ✅ Mejor para producción

¡Listo para crecer! 🚀
