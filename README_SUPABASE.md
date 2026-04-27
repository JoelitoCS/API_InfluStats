# 🔄 InfluStats - Migración completada a Supabase (PostgreSQL)

## 📢 IMPORTANTE: Se ha migrado de MongoDB a Supabase

Tu proyecto ahora usa **PostgreSQL** (mediante Supabase) con **Prisma** como ORM.

---

## 🚀 Inicio Rápido (3 minutos)

### 1. Lee la guía rápida
```bash
Ver: SUPABASE_3MIN.md
```

### 2. Configura DATABASE_URL
```env
# Ve a https://supabase.com
# Copia tu DATABASE_URL en .env
DATABASE_URL="postgresql://..."
```

### 3. Ejecuta migraciones
```bash
npm run prisma:migrate
```

### 4. Inicia servidor
```bash
npm run dev
```

---

## 📊 ¿Qué cambió?

| Aspecto | Antes | Ahora |
|---------|-------|-------|
| **BD** | MongoDB (NoSQL) | PostgreSQL (SQL) |
| **ORM** | Mongoose | Prisma |
| **Host** | Local/Atlas | Supabase |
| **Modelo** | models/User.js | prisma/schema.prisma |

**Validaciones, endpoints y frontend:** ✅ Sin cambios

---

## 📁 Estructura actual

```
API_InfluStats/
├── index.js                     ← Servidor (Express + Prisma)
├── controller/
│   └── authController.js        ← Lógica (ahora con Prisma)
├── routes/
│   └── auth.js                  ← Rutas /api/auth/*
├── prisma/
│   └── schema.prisma            ← Esquema PostgreSQL
├── public/                       ← Frontend (sin cambios)
│   ├── index.html
│   ├── login.html
│   ├── app.js
│   └── login.js
└── Documentación/
    ├── SUPABASE_3MIN.md         ← Start here ⭐
    ├── SUPABASE_SETUP.md
    ├── MIGRATION_MONGODB_TO_SUPABASE.md
    └── ...
```

---

## 🔧 Comandos nuevos

```bash
npm run dev                  # Servidor en desarrollo
npm run start                # Servidor en producción
npm run prisma:migrate      # Crear/actualizar BD
npm run prisma:generate     # Generar cliente de Prisma
npm run prisma:studio       # Ver datos gráficamente (http://localhost:5555)
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

Ver `.env.example` para template.

---

## ✅ Validaciones mantidas

- ✓ Email único (verificado en BD)
- ✓ Contraseña 8+ caracteres
- ✓ Mayúsculas, minúsculas, números
- ✓ Encriptación bcryptjs
- ✓ JWT tokens de 30 días
- ✓ Endpoints /api/auth/register y /api/auth/login

---

## 🗄️ Tabla User

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

---

## 📚 Documentación

1. **SUPABASE_3MIN.md** ← Empieza aquí (3 min)
2. **SUPABASE_SETUP.md** ← Setup detallado
3. **MIGRATION_MONGODB_TO_SUPABASE.md** ← Qué cambió
4. **README.md** ← Docs técnicas
5. **requests.http** ← Tests de API

---

## 🎯 Próximos pasos

1. Crea cuenta en Supabase: https://supabase.com
2. Copia DATABASE_URL al .env
3. Ejecuta: `npm run prisma:migrate`
4. Inicia: `npm run dev`
5. Prueba: http://localhost:3000

---

## 🆘 Solucionar problemas

### Error: "ECONNREFUSED"
```
Verifica que DATABASE_URL sea correcto en .env
```

### Error: "authentication failed"
```
Contraseña de Supabase incorrecta
```

### Error: "relation User does not exist"
```
Ejecuta: npm run prisma:migrate
```

---

## 📞 Preguntas

**¿Es gratis?**
Sí, Supabase tiene plan gratuito generoso.

**¿Cambió el frontend?**
No, funciona igual.

**¿Debo instalar PostgreSQL?**
No, Supabase lo provee.

**¿Cómo migro datos antiguos?**
Ver: MIGRATION_MONGODB_TO_SUPABASE.md

---

## 🎉 Estado

- ✅ Backend migrado a Prisma
- ✅ PostgreSQL schema creado
- ✅ Validaciones intactas
- ✅ Frontend sin cambios
- ✅ Documentación actualizada
- ⏳ Supabase (pendiente de configuración)

---

**Listo para empezar?**

Lee: **SUPABASE_3MIN.md** 📖

¡Éxito! 🚀
