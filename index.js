import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes    from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import metricsRoutes from './routes/metrics.js';
import rankingRoutes from './routes/ranking.js';
import { prisma } from './lib/prisma.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

async function conectarBaseDatos() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('OK Conectado a Supabase PostgreSQL');
  } catch (error) {
    console.error('Error al conectar a Supabase:', error.message);
    process.exit(1);
  }
}
conectarBaseDatos();

app.use('/api/auth',    authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/profiles',    profileRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/ranking', rankingRoutes);

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

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Ruta no encontrada' });
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
