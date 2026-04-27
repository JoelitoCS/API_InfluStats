# 🚀 Configurar Supabase (PostgreSQL) para InfluStats

## 📋 Cambio de Base de Datos

Se ha migrado de **MongoDB** a **Supabase (PostgreSQL)** utilizando **Prisma** como ORM.

**Ventajas de PostgreSQL + Prisma:**
- ✅ SQL estándar (compatible con muchas plataformas)
- ✅ Relaciones más robustas
- ✅ Mejor para datos estructurados
- ✅ Prisma simplifica el manejo de BD
- ✅ Supabase ofrece hosting gratuito
- ✅ Dashboard web para gestionar datos

---

## 🎯 Opción 1: Supabase Cloud (⭐ RECOMENDADO)

### Paso 1: Crear cuenta en Supabase

1. Ve a: https://supabase.com/
2. Haz clic en "Sign Up"
3. Completa el registro (puedes usar GitHub o email)

### Paso 2: Crear un proyecto

1. Haz clic en "New project"
2. Completa:
   - **Project name:** `influStats` (o el que desees)
   - **Database password:** Crea una contraseña segura (guárdala)
   - **Region:** Elige la más cercana (ej: N. Virginia para América)
3. Haz clic en "Create new project"

⏳ Espera 1-2 minutos mientras se crea...

### Paso 3: Obtener DATABASE_URL

1. Ve a "Settings" → "Database"
2. Busca "Connection Pooling"
3. Cambia a "Session mode"
4. Copia la URL que comienza con `postgresql://`
5. Asegúrate de que contenga tu contraseña

**Formato de la URL:**
```
postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres
```

### Paso 4: Actualizar .env

Abre `.env` en tu proyecto y reemplaza:

```env
DATABASE_URL="postgresql://postgres:TU_CONTRASEÑA@db.xxxxx.supabase.co:5432/postgres"
```

---

## 🎯 Opción 2: PostgreSQL Local (Solo desarrollo)

### Windows - Con WSL

```bash
# En PowerShell como administrador
wsl
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo service postgresql start

# Acceder a PostgreSQL
psql -U postgres
```

En PostgreSQL:
```sql
CREATE DATABASE influStats;
\q
```

Tu `.env`:
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/influStats"
```

### Verificar que funciona

```bash
psql -U postgres -d influStats -c "SELECT 1;"
```

Si ves `1`, ¡está funcionando!

---

## ⚙️ Aplicar migraciones de Prisma

Una vez que DATABASE_URL esté configurado:

### Paso 1: Generar cliente de Prisma
```bash
npm run prisma:generate
```

### Paso 2: Ejecutar migraciones
```bash
npm run prisma:migrate
```

Esto creará la tabla `User` en tu BD.

Cuando te pida un nombre para la migración, escribe:
```
create_user_table
```

### Verificar que funcionó

```bash
npm run prisma:studio
```

Se abrirá una interfaz gráfica donde verás la tabla `User`.

---

## 🚀 Iniciar servidor

```bash
npm run dev
```

Deberías ver:
```
✓ Conectado a Supabase (PostgreSQL)
✓ Servidor corriendo en http://localhost:3000
```

---

## 🧪 Probar el registro

### Opción A: Frontend (más fácil)
1. Abre: http://localhost:3000
2. Registra un usuario
3. Verifica en Prisma Studio que aparezca

### Opción B: Prisma Studio
```bash
npm run prisma:studio
```
Abre tu navegador en http://localhost:5555

### Opción C: REST Client
Abre `requests.http` y prueba el endpoint

---

## 📊 Ver datos en Supabase

### Opción 1: Prisma Studio
```bash
npm run prisma:studio
```

### Opción 2: Dashboard de Supabase
1. Ve a https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a "SQL Editor"
4. Ejecuta:
```sql
SELECT * FROM "User";
```

### Opción 3: Interfaz de Supabase
1. Ve a "Table Editor"
2. Selecciona tabla "User"
3. Verás todos los usuarios registrados

---

## ⚠️ Solucionar problemas

### Error: "connect ECONNREFUSED"
- Verifica que DATABASE_URL esté bien en .env
- Verifica que la contraseña sea correcta
- Si es Supabase: Verifica que el proyecto esté activo

### Error: "getaddrinfo ENOTFOUND"
- La URL está malformada
- Copia exactamente desde Supabase

### Error: "password authentication failed"
- La contraseña es incorrecta
- Ve a Supabase y reset la contraseña de BD

### Error: "relation \"User\" does not exist"
- Aún no has ejecutado las migraciones
- Ejecuta: `npm run prisma:migrate`

---

## 📝 Cambios realizados

### Dependencias removidas
- ❌ `mongoose` (MongoDB ORM)

### Dependencias agregadas
- ✅ `@prisma/client` (Cliente de Prisma)
- ✅ `prisma` (CLI de Prisma)

### Archivos modificados
- ✅ `controller/authController.js` - Ahora usa Prisma
- ✅ `index.js` - Ahora usa Prisma en lugar de Mongoose
- ✅ `package.json` - Removido Mongoose, agregado Prisma
- ✅ `.env` - Cambio de MONGODB_URI a DATABASE_URL

### Archivos creados
- ✅ `prisma/schema.prisma` - Esquema de la BD
- ✅ `prisma/.env` - Configuración de Prisma

### Validaciones mantidas
- ✅ Email único (verificado en BD)
- ✅ Contraseña 8+ caracteres
- ✅ Mayúsculas, minúsculas, números
- ✅ Encriptación bcryptjs
- ✅ Token JWT

---

## 🔐 Seguridad

### En Producción (Supabase)
- Usa conexión SSL (Supabase ya lo hace)
- Cambia la contraseña de BD regularmente
- Usa variables de entorno seguras
- No commits .env a Git

### En Desarrollo
- .env.local está en .gitignore
- Para testing, usa BD local

---

## 📚 Recursos útiles

- Supabase Docs: https://supabase.com/docs
- Prisma Docs: https://www.prisma.io/docs
- PostgreSQL: https://www.postgresql.org/docs/

---

## 🎯 Próximos pasos

1. ✅ Configura DATABASE_URL en .env
2. ✅ Ejecuta `npm run prisma:migrate`
3. ✅ Inicia servidor: `npm run dev`
4. ✅ Prueba en http://localhost:3000

¡Listo! Tu BD está migrada a PostgreSQL con Supabase. 🎉
