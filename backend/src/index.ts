import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { initDatabase } from './models/database';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Crear directorio de datos si no existe
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Logging de requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Iniciar servidor
async function startServer() {
  try {
    // Inicializar base de datos
    console.log('Inicializando base de datos...');
    await initDatabase();
    console.log('Base de datos inicializada correctamente');

    // Cargar rutas después de inicializar DB
    const routes = (await import('./routes')).default;
    app.use('/api', routes);

    // Servir frontend en producción
    if (process.env.NODE_ENV === 'production') {
      const frontendPath = path.join(__dirname, '../../frontend/dist');
      app.use(express.static(frontendPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(frontendPath, 'index.html'));
      });
    }

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║     GESTIÓN DE CONDUCTORES - CE 561/2006              ║
╠═══════════════════════════════════════════════════════╣
║  Servidor iniciado en http://localhost:${PORT}          ║
║  API disponible en http://localhost:${PORT}/api         ║
╚═══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Error iniciando servidor:', error);
    process.exit(1);
  }
}

startServer();

export default app;
