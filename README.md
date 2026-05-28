# InfluStats API

API REST para gestión y análisis de métricas de influencers en redes sociales.

**Stack:** Node.js · Express 5 · Prisma 7 · Supabase (PostgreSQL) · JWT

---

## Índice

1. [Instalación](#1-instalación)
2. [Variables de entorno](#2-variables-de-entorno)
3. [Scripts disponibles](#3-scripts-disponibles)
4. [Arquitectura](#4-arquitectura)
5. [Autenticación](#5-autenticación)
6. [Endpoints — Auth](#6-endpoints--auth)
7. [Endpoints — Profiles](#7-endpoints--profiles)
8. [Endpoints — Metrics](#8-endpoints--metrics)
9. [Endpoints — Ranking](#9-endpoints--ranking)
10. [Endpoints — Admin](#10-endpoints--admin)
11. [Middlewares](#11-middlewares)
12. [Modelo de datos](#12-modelo-de-datos)
13. [Fórmulas de engagement](#13-fórmulas-de-engagement)
14. [Códigos de error](#14-códigos-de-error)
15. [Historial: de MongoDB a Supabase](#15-historial-de-mongodb-a-supabase)

---

## 1. Instalación

```bash
git clone <repo-url>
cd API_InfluStats
npm install
cp .env.example .env          # editar con DATABASE_URL y JWT_SECRET
npm run prisma:generate
npm run dev
```

---

## 2. Variables de entorno

```env
DATABASE_URL=postgresql://...  # Cadena de conexión Supabase (Connection Pooling › Session)
JWT_SECRET=secreto_jwt         # Clave para firmar tokens
PORT=3001                      # Opcional, por defecto 3001
```

---

## 3. Scripts disponibles

| Script | Acción |
|---|---|
| `npm run dev` | Servidor en desarrollo (nodemon) |
| `npm start` | Servidor en producción |
| `npm run prisma:generate` | Genera el cliente Prisma |
| `npm run prisma:migrate` | Aplica migraciones a la BD |
| `npm run prisma:studio` | Interfaz gráfica de datos en `localhost:5555` |

---

## Usuarios y credenciales

La mayoria utilizan de contraseña Demo1234!, menos joelcanosan@gmail.com y ivangarciac10@gmail.com.

`Admin` | admin@admin.com ----- Admin123 |
`Algunos mails con contraseña Demo1234! ` | techguru@demo.com, gamedreamer@demo.com,fitlifepro@demo.com,foodiequeen@demo.com, travelblogger@demo.com, codervibes@demo.com, beautyglam@demo.com, musicmaker@demo.com, gamingking@demo.com  |


## 4. Arquitectura

```
API_InfluStats/
├── index.js              # Entrada: Express, CORS, montaje de routers
├── routes/
│   ├── auth.js           # POST /api/auth/*
│   ├── profiles.js       # /api/profiles
│   ├── metrics.js        # /api/metrics
│   └── ranking.js        # /api/ranking
├── controller/
│   ├── authController.js
│   ├── profilesController.js
│   ├── metricsController.js
│   └── rankingController.js
├── middleware/
│   ├── authMiddleware.js       # protect — valida JWT
│   └── ownershipMiddleware.js  # validateOwnership — verifica propietario
├── lib/
│   └── prisma.js         # Instancia compartida de PrismaClient
├── prisma/
│   └── schema.prisma     # Esquema PostgreSQL
├── public/               # Assets estáticos
├── .env.example
└── requests.http         # Ejemplos REST Client (VS Code)
```

**Base URL local:** `http://localhost:3001`  
**Prefijo de API:** `/api`  
**Formato:** `application/json`

---

## 5. Autenticación

Todas las rutas excepto `/api/auth/register` y `/api/auth/login` requieren:

```
Authorization: Bearer <token>
```

El token se obtiene al registrarse o al hacer login. Expira en **30 días**.

---

## 6. Endpoints — Auth

### `POST /api/auth/register`

Crea un usuario nuevo y devuelve un JWT.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Password123",
  "passwordConfirm": "Password123"
}
```

**Validaciones:** email con formato válido y único, contraseña mínimo 8 caracteres con mayúsculas + minúsculas + números, confirmación coincidente.

**Respuesta `201`:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGci...",
  "usuario": {
    "id": "uuid",
    "email": "usuario@ejemplo.com",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

| Código | Motivo |
|---|---|
| `400` | Campos vacíos, contraseñas no coinciden, email inválido, contraseña débil, email ya registrado |
| `500` | Error interno |

---

### `POST /api/auth/login`

Valida credenciales, actualiza `lastLogin` y devuelve un JWT.

**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "Password123"
}
```

**Respuesta `200`:**
```json
{
  "success": true,
  "message": "Login exitoso",
  "token": "eyJhbGci...",
  "usuario": { "id": "uuid", "email": "usuario@ejemplo.com" }
}
```

| Código | Motivo |
|---|---|
| `400` | Campos vacíos |
| `401` | Email o contraseña incorrectos |

---

## 7. Endpoints — Profiles

> Todas las rutas requieren `Authorization: Bearer <token>`.

### `GET /api/profiles`

Devuelve todos los perfiles del usuario autenticado (orden: más reciente primero).

**Respuesta `200`:**
```json
{
  "success": true,
  "profiles": [
    {
      "id": "uuid",
      "username": "MiCanal",
      "url": "https://instagram.com/micanal",
      "platform": "instagram",
      "userId": "uuid",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### `POST /api/profiles`

Crea un perfil social. Un usuario solo puede tener **un perfil por plataforma**.

**Body:**
```json
{
  "name": "MiCanal",
  "url": "https://instagram.com/micanal",
  "platform": "instagram"
}
```

| Campo | Requerido | Notas |
|---|---|---|
| `name` | ✅ | Nombre visible |
| `url` | ✅ | Debe comenzar con `http://` o `https://` |
| `platform` | ✅ | `instagram` · `youtube` · `tiktok` · `twitch` (insensible a mayúsculas) |

**Respuesta `201`:** objeto `profile` creado.

| Código | Motivo |
|---|---|
| `400` | Campos faltantes, plataforma inválida o URL inválida |
| `409` | Ya existe un perfil para esa plataforma |

---

### `PUT /api/profiles/:id`

Actualización parcial de un perfil. Solo puede editarlo el propietario.

**Body (todos opcionales, al menos uno):**
```json
{ "name": "NuevoNombre", "url": "https://...", "platform": "tiktok" }
```

**Respuesta `200`:** objeto `profile` actualizado.

| Código | Motivo |
|---|---|
| `400` | Sin campos o datos inválidos |
| `403` | El perfil no pertenece al usuario |
| `404` | Perfil no encontrado |

---

### `DELETE /api/profiles/:id`

Elimina un perfil del usuario autenticado. Solo puede borrarlo el propietario.

**Respuesta `200`:**
```json
{ "success": true, "message": "Perfil eliminado correctamente" }
```

| Código | Motivo |
|---|---|
| `403` | No es el propietario |
| `404` | Perfil no encontrado |

---

## 8. Endpoints — Metrics

> Todas las rutas requieren `Authorization: Bearer <token>`.

### `GET /api/metrics/summary`

Resumen global con las últimas métricas de todos los perfiles del usuario.

> ⚠️ Declarado antes de `/:profileId` para que Express no lo interprete como ID.

**Respuesta `200`:**
```json
{
  "success": true,
  "summary": {
    "totalProfiles": 3,
    "totalFollowers": 125000,
    "totalViews": 980000,
    "avgEngagement": 4.75,
    "platformBreakdown": {
      "instagram": 45000,
      "tiktok": 60000,
      "youtube": 20000,
      "twitch": 0
    },
    "profilesWithData": 3
  }
}
```

---

### `GET /api/metrics/staleness`

Devuelve los perfiles con más de 7 días sin registro de métricas.

**Respuesta `200`:**
```json
{
  "success": true,
  "stale": [
    { "id": "uuid", "username": "micanal", "platform": "instagram", "daysAgo": 10 }
  ]
}
```

> `daysAgo` es `null` si el perfil nunca tuvo métricas.

---

### `GET /api/metrics/compare/:profileId`

Compara las métricas actuales de un perfil con las de un período anterior.

**Query params:**

| Parámetro | Requerido | Valores |
|---|---|---|
| `period` | ✅ | `1w` · `2w` · `1m` · `3m` · `6m` · `1y` · `custom` |
| `fromDate` | Solo si `period=custom` | `YYYY-MM-DD` |

---

### `POST /api/metrics/:profileId`

Guarda las métricas semanales de un perfil. Los campos varían según la plataforma del perfil. `engagement` y `growth` se calculan automáticamente.

**Campo común:**

| Campo | Tipo | Requerido |
|---|---|---|
| `weekDate` | `YYYY-MM-DD` | ✅ |

**Campos por plataforma:**

| Plataforma | Campos enteros (≥ 0) | Campos decimales |
|---|---|---|
| `instagram` | `views`, `likes`, `favorites`, `followers`, `posts` | — |
| `youtube` | `views`, `likes`, `subscribers`, `paidMembers` | `donations` (€) |
| `tiktok` | `views`, `likes`, `comments`, `favorites`, `shares`, `followers` | — |
| `twitch` | `views`, `followers`, `subscribersTwitch`, `bits` | — |

**Ejemplo (Instagram):**
```json
{
  "weekDate": "2025-01-13",
  "views": 15000,
  "likes": 800,
  "favorites": 120,
  "followers": 45000,
  "posts": 5
}
```

**Respuesta `201`:**
```json
{
  "success": true,
  "message": "Metricas guardadas correctamente",
  "metrics": {
    "id": "uuid",
    "profileId": "uuid",
    "weekDate": "2025-01-13T00:00:00.000Z",
    "engagement": 6.13,
    "growth": 2.3,
    "detail": { "views": 15000, "likes": 800, "favorites": 120, "followers": 45000, "posts": 5 }
  }
}
```

> `growth` es `null` si es el primer registro del perfil o el valor anterior era 0.

| Código | Motivo |
|---|---|
| `400` | `weekDate` inválido o campos numéricos incorrectos (array `errors` con detalle) |
| `404` | Perfil no encontrado o sin permisos |

---

### `GET /api/metrics/:profileId`

Historial completo de métricas de un perfil, ordenado por fecha descendente. Los campos base y los específicos de plataforma vienen aplanados al mismo nivel.

**Respuesta `200`:**
```json
{
  "success": true,
  "metrics": [
    {
      "id": "uuid",
      "profileId": "uuid",
      "weekDate": "2025-01-13T00:00:00.000Z",
      "engagement": 6.13,
      "growth": 2.3,
      "views": 15000,
      "likes": 800,
      "favorites": 120,
      "followers": 45000,
      "posts": 5
    }
  ]
}
```

---

## 9. Endpoints — Ranking

> Requiere `Authorization: Bearer <token>`.

### `GET /api/ranking`

Ranking público de todos los perfiles de una plataforma con al menos un registro de métricas.

**Query params:**

| Parámetro | Requerido | Valores | Default |
|---|---|---|---|
| `platform` | ✅ | `instagram` · `youtube` · `tiktok` · `twitch` | — |
| `sort` | ❌ | `followers` · `engagement` · `growth` · `views` | `followers` |

**Ejemplo:** `GET /api/ranking?platform=instagram&sort=engagement`

**Respuesta `200`:**
```json
{
  "success": true,
  "platform": "instagram",
  "sort": "engagement",
  "total": 2,
  "ranking": [
    {
      "position": 1,
      "profileId": "uuid",
      "username": "top_influencer",
      "url": "https://instagram.com/top_influencer",
      "platform": "instagram",
      "weekDate": "2025-01-13T00:00:00.000Z",
      "followers": 80000,
      "views": 50000,
      "engagement": 8.50,
      "growth": 3.20
    }
  ]
}
```

> Los perfiles con `growth: null` aparecen al final cuando se ordena por `growth`.

| Código | Motivo |
|---|---|
| `400` | `platform` inválida o `sort` no permitido |

---

### `GET /api/ranking/compare`

Compara las últimas métricas de dos perfiles públicos de la misma plataforma.

**Query params:** `profileA` (UUID) y `profileB` (UUID), ambos requeridos.

**Respuesta `200`:**
```json
{
  "success": true,
  "platform": "instagram",
  "fields": ["views", "likes", "favorites", "followers", "posts", "engagement"],
  "profileA": {
    "username": "perfil_a",
    "weekDate": "2025-01-13T00:00:00.000Z",
    "metrics": { "views": 15000, "likes": 800, "engagement": 6.13 }
  },
  "profileB": {
    "username": "perfil_b",
    "weekDate": "2025-01-13T00:00:00.000Z",
    "metrics": { "views": 22000, "likes": 1400, "engagement": 8.50 }
  },
  "diff": {
    "views": { "winner": "B", "absolute": 7000, "percent": 46.7 }
  },
  "score": { "A": 0, "B": 5, "tie": 1 }
}
```

---

## 10. Endpoints — Admin

> Requieren `Authorization: Bearer <token>` con rol `admin`.

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/admin/users` | Lista todos los usuarios con conteo de perfiles |
| `DELETE` | `/api/admin/users/:userId` | Elimina un usuario (no disponible para admins) |
| `GET` | `/api/admin/profiles` | Lista todos los perfiles con propietario y conteo de métricas |
| `DELETE` | `/api/admin/profiles/:profileId` | Elimina cualquier perfil |
| `GET` | `/api/admin/metrics/:profileId` | Historial de métricas de cualquier perfil |
| `PUT` | `/api/admin/metrics/:metricsId` | Edita un registro (recalcula engagement y growth) |
| `DELETE` | `/api/admin/metrics/:metricsId` | Elimina un registro de métricas |
| `DELETE` | `/api/admin/all-metrics/:profileId` | Borra todas las métricas de un perfil |

**Ejemplo `GET /api/admin/users`:**
```json
{
  "success": true,
  "users": [
    {
      "id": "uuid",
      "email": "admin@ejemplo.com",
      "role": "admin",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "lastLogin": "2025-01-15T10:00:00.000Z",
      "_count": { "socialProfiles": 3 }
    }
  ]
}
```

| Código | Motivo |
|---|---|
| `401` | Token ausente o inválido |
| `403` | El usuario no tiene rol `admin` |

---

## 11. Middlewares

### `protect`

Valida el JWT del header `Authorization: Bearer <token>`. Verifica firma, expiración y existencia del usuario en BD. Inyecta `req.user = { id, email }`.

### `validateOwnership`

Se coloca siempre después de `protect`. Comprueba que el perfil en `:id` pertenece a `req.user.id`. Devuelve `403` genérico si no coincide (no revela si el perfil existe para otro usuario). Adjunta `req.profile` para evitar una segunda consulta en el controlador.

---

## 12. Modelo de datos

```
User
 └── SocialProfile (1:N)
      └── MetricsHistory (1:N)
           ├── MetricsYoutube   (1:1)
           ├── MetricsTiktok    (1:1)
           ├── MetricsTwitch    (1:1)
           └── MetricsInstagram (1:1)
```

Cada fila de `MetricsHistory` representa una semana de datos de un perfil. Los campos `engagement` y `growth` son calculados por el backend y nunca los envía el cliente.

---

## 13. Fórmulas de engagement

El engagement se calcula automáticamente al guardar cada registro. Valor máximo: `100.00`.

| Plataforma | Fórmula |
|---|---|
| Instagram | `((likes + favorites) / views) × 100` |
| YouTube | `(likes / views) × 100` |
| TikTok | `((likes + comments + favorites + shares) / views) × 100` |
| Twitch | `(subscribersTwitch / followers) × 100` |

El `growth` compara el campo principal de la plataforma (`followers` o `subscribers`) respecto a la semana anterior:

```
growth = ((valorActual - valorAnterior) / valorAnterior) × 100
```

Es `null` en el primer registro o si el valor anterior era `0`.

---

## 14. Códigos de error

| Código | Significado |
|---|---|
| `400` | Bad Request — datos inválidos o faltantes |
| `401` | Unauthorized — token ausente, expirado o inválido |
| `403` | Forbidden — recurso existente pero sin permiso |
| `404` | Not Found — recurso no encontrado |
| `409` | Conflict — duplicado (email, plataforma) |
| `500` | Internal Server Error |

**Formato estándar:**
```json
{ "success": false, "message": "Descripción del error" }
```

**Con múltiples errores de validación (métricas):**
```json
{
  "success": false,
  "message": "Errores de validacion",
  "errors": ["views debe ser un numero entero >= 0"]
}
```

---

## 15. Historial: de MongoDB a Supabase

El proyecto comenzó con MongoDB + Mongoose. Durante el desarrollo se migró a **Supabase (PostgreSQL) + Prisma** por las siguientes razones:

- PostgreSQL con relaciones fuertes encaja mejor con el modelo de datos (User → Profiles → Metrics)
- Prisma ofrece tipado y transacciones `$transaction` que el proyecto usa en `createMetrics`
- Supabase proporciona hosting gratuito, dashboard web y conexión SSL automática
- Los endpoints, las validaciones y el frontend no cambiaron con la migración

**Lo que cambió internamente:**

| Aspecto | Antes | Ahora |
|---|---|---|
| Base de datos | MongoDB | PostgreSQL (Supabase) |
| ORM | Mongoose | Prisma 7 |
| Variable de entorno | `MONGODB_URI` | `DATABASE_URL` |
| Modelo | `models/User.js` | `prisma/schema.prisma` |
| Queries | `User.findOne()` | `prisma.user.findUnique()` |
