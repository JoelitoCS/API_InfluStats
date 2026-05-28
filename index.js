// ─────────────────────────────────────────────────────────────────────────────
//  index.js — Punto de entrada del servidor Express
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import dotenv  from 'dotenv';
import cors    from 'cors';

import authRoutes        from './routes/auth.js';
import profileRoutes     from './routes/profiles.js';
import metricsRoutes     from './routes/metrics.js';
import rankingRoutes     from './routes/ranking.js';
import adminRoutes       from './routes/admin.js';
import userProfileRoutes from './routes/userProfile.js';

import { sanitizeInput } from './middleware/sanitizeMiddleware.js';
import { prisma }        from './lib/prisma.js';
import { startCron }     from './lib/cron.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

// ── CORS — orígenes permitidos ────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://influstats.vercel.app',
  // Por si Vercel genera preview URLs (*.vercel.app)
  /\.vercel\.app$/,
];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir llamadas sin origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    const allowed = ALLOWED_ORIGINS.some((o) =>
      o instanceof RegExp ? o.test(origin) : o === origin
    );

    if (allowed) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueado para origin: ${origin}`);
      callback(new Error(`CORS: origen no permitido → ${origin}`));
    }
  },
  credentials: true,
}));

app.use(express.json());
app.use(sanitizeInput);
app.use(express.static('public'));

// ── Verificación de conexión a la base de datos ───────────────────────────────
async function conectarBaseDatos() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Conectado a Supabase PostgreSQL');
  } catch (error) {
    console.error('❌ Error al conectar a Supabase:', error.message);
    process.exit(1);
  }
}
conectarBaseDatos();

// ── Registro de routers ───────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/profiles',     profileRoutes);
app.use('/profiles',         profileRoutes);
app.use('/api/metrics',      metricsRoutes);
app.use('/api/ranking',      rankingRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/user-profile', userProfileRoutes);

app.get('/', (req, res) => {
  res.json({
    message: 'InfluStats API',
    version: '2.0',
    status:  'online',
    endpoints: {
      register:      'POST /api/auth/register',
      login:         'POST /api/auth/login',
      createProfile: 'POST /api/profiles',
      addMetrics:    'POST /api/metrics/:profileId',
      getRanking:    'GET  /api/ranking?platform=instagram&sort=followers',
      myProfile:     'GET  /api/user-profile/me',
      editProfile:   'PUT  /api/user-profile/me',
      uploadAvatar:  'POST /api/user-profile/me/avatar',
      publicProfile: 'GET  /api/user-profile/:username',
      searchUsers:   'GET  /api/user-profile/search?q=jo',
      exploreUsers:  'GET  /api/user-profile/explore',
      socialLinks:   'PUT  /api/user-profile/me/social-links',
    },
  });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  startCron();
});
