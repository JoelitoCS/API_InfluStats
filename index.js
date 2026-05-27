// ─────────────────────────────────────────────────────────────────────────────
//  index.js — Punto de entrada del servidor Express
//
//  Qué hace este archivo:
//    1. Carga variables de entorno desde .env (dotenv)
//    2. Crea la aplicación Express y aplica middlewares globales
//    3. Comprueba la conexión a la base de datos al arrancar
//    4. Registra los 5 routers (auth, profiles, metrics, ranking, admin)
//    5. Arranca el servidor en el puerto configurado
//    6. Lanza el cron job de detección de perfiles desactualizados
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Routers: cada uno agrupa las rutas de un recurso
import authRoutes    from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import metricsRoutes from './routes/metrics.js';
import rankingRoutes from './routes/ranking.js';
import adminRoutes   from './routes/admin.js';
import { sanitizeInput } from './middleware/sanitizeMiddleware.js';

// prisma: instancia única del cliente de base de datos (ver lib/prisma.js)
import { prisma }    from './lib/prisma.js';

// startCron: arranca el job periódico que marca perfiles sin actualizar
import { startCron } from './lib/cron.js';

// Carga DATABASE_URL, JWT_SECRET y PORT desde el archivo .env
dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001; // Puerto por defecto: 3001

// ── Middlewares globales ──────────────────────────────────────────────────────

// cors(): permite que el frontend (Next.js en otro puerto) llame a esta API
// sin que el navegador bloquee la petición por política de origen cruzado.
app.use(cors());

// express.json(): analiza el body de las peticiones POST/PUT que lleguen
// con Content-Type: application/json y lo pone disponible en req.body.
app.use(express.json());
app.use(sanitizeInput);

// express.static('public'): sirve archivos estáticos (HTML, JS, CSS) de la
// carpeta /public. Útil para el formulario de prueba en desarrollo.
app.use(express.static('public'));

// ── Verificación de conexión a la base de datos ───────────────────────────────
// Se ejecuta una query mínima (SELECT 1) para confirmar que Supabase responde.
// Si falla, el proceso termina con exit(1) en lugar de arrancar sin BD.
async function conectarBaseDatos() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('OK Conectado a Supabase PostgreSQL');
  } catch (error) {
    console.error('Error al conectar a Supabase:', error.message);
    process.exit(1); // No tiene sentido arrancar sin base de datos
  }
}
conectarBaseDatos();

// ── Registro de routers ───────────────────────────────────────────────────────
// Cada app.use() monta un router en un prefijo de URL.
// Express redirige la petición al router correcto según el prefijo.

app.use('/api/auth',     authRoutes);    // POST /api/auth/register  y  /api/auth/login
app.use('/api/profiles', profileRoutes); // CRUD de perfiles sociales
app.use('/profiles',     profileRoutes); // Alias sin /api (compatibilidad con el frontend v1)
app.use('/api/metrics',  metricsRoutes); // Métricas semanales + resumen + staleness + compare
app.use('/api/ranking',  rankingRoutes); // Ranking público + comparativa entre perfiles
app.use('/api/admin',    adminRoutes);   // Panel admin (requiere role='admin')

// ── Ruta raíz: índice de endpoints ───────────────────────────────────────────
// Devuelve un JSON informativo cuando alguien hace GET / en el navegador.
// No requiere autenticación: es solo documentación en vivo.
app.get('/', (req, res) => {
  res.json({
    message:  'Bienvenido a InfluStats API',
    database: 'Supabase PostgreSQL',
    endpoints: {
      register:     'POST /api/auth/register',
      login:        'POST /api/auth/login',
      createProfile:'POST /api/profiles',
      addMetrics:   'POST /api/metrics/:profileId',
      getMetrics:   'GET  /api/metrics/:profileId',
      getSummary:   'GET  /api/metrics/summary',
      getRanking:   'GET  /api/ranking?platform=instagram&sort=followers',
    },
  });
});

// ── Middleware de 404 ─────────────────────────────────────────────────────────
// Se ejecuta cuando ningún router anterior coincidió con la URL pedida.
// app.use() sin ruta actúa como "catch-all" al final de la cadena.
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

// ── Cierre limpio al pulsar Ctrl+C ───────────────────────────────────────────
// SIGINT es la señal que envía el sistema operativo al pulsar Ctrl+C.
// Desconectamos Prisma antes de salir para cerrar correctamente el pool de BD.
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// ── Arranque del servidor ─────────────────────────────────────────────────────
// app.listen() bloquea el puerto y pone Express a escuchar peticiones HTTP.
// El callback se ejecuta cuando el servidor está listo.
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  startCron(); // Lanza el job de detección de perfiles desactualizados
});
