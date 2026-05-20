import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import metricsRoutes from './routes/metrics.js'; // Historial semanal de métricas
import { prisma } from './lib/prisma.js';

// Carga variables como DATABASE_URL, JWT_SECRET y PORT desde .env.
dotenv.config();

const app = express();

// La API corre en 3001 para dejar 3000 libre al frontend Next.
const PORT = process.env.PORT || 3001;

// Middlewares base: CORS para frontend, JSON para APIs y estaticos legacy.
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Comprueba que Prisma puede hablar con PostgreSQL antes de aceptar peticiones.
async function conectarBaseDatos() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('OK Conectado a Supabase PostgreSQL');
    } catch (error) {
        console.error('Error al conectar a Supabase:', error.message);
        console.error('Configura DATABASE_URL correctamente en .env');
        process.exit(1);
    }
}

conectarBaseDatos();

// Rutas de autenticacion usadas por el frontend.
app.use('/api/auth', authRoutes);

// Rutas de perfiles sociales usadas por el frontend Next.
app.use('/api/profiles', profileRoutes);

// Alias solicitado para pruebas directas en localhost:3001/profiles.
app.use('/profiles', profileRoutes);

// Rutas de métricas semanales: POST y GET /api/metrics/:profileId
app.use('/api/metrics', metricsRoutes);

// Ruta de salud/documentacion minima de la API.
app.get('/', (req, res) => {
    res.json({
        message: 'Bienvenido a InfluStats API',
        database: 'Supabase PostgreSQL',
        endpoints: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            createProfile: 'POST /api/profiles',
            addMetrics:   'POST /api/metrics/:profileId',
            getMetrics:   'GET  /api/metrics/:profileId',
            getSummary:   'GET  /api/metrics/summary'
        }
    });
});

// Respuesta uniforme para rutas inexistentes.
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
    });
});

// Cierra la conexion de Prisma cuando el proceso se detiene manualmente.
process.on('SIGINT', async () => {
    console.log('\nDesconectando de la base de datos...');
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
