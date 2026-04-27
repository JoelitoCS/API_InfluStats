import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Servir archivos estáticos

// Verificar conexión a Supabase (PostgreSQL)
async function conectarBaseDatos() {
    try {
        await prisma.$queryRaw`SELECT 1`;
        console.log('✓ Conectado a Supabase (PostgreSQL)');
    } catch (error) {
        console.error('✗ Error al conectar a Supabase:', error.message);
        console.error('\n⚠️  Asegúrate de que DATABASE_URL esté configurado correctamente en .env');
        console.error('   Formato: postgresql://[usuario]:[contraseña]@[host]:[puerto]/[base_datos]');
        process.exit(1);
    }
}

conectarBaseDatos();

// Rutas
app.use('/api/auth', authRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({
        message: 'Bienvenido a InfluStats API',
        database: 'Supabase (PostgreSQL)',
        endpoints: {
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login'
        }
    });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Ruta no encontrada'
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n✓ Desconectando de la base de datos...');
    await prisma.$disconnect();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`✓ Servidor corriendo en http://localhost:${PORT}`);
});

