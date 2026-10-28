import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';

// Importación de rutas de módulos
import authRoutes from './modulos/auth/auth.routes.js';
import usuariosRoutes from './modulos/usuarios/usuarios.routes.js';
import clientesRoutes from './modulos/clientes/clientes.routes.js';
import planesRoutes from './modulos/planes/planes.routes.js';
import membresiasRoutes from './modulos/membresias/membresias.routes.js';
import pagosRoutes from './modulos/pagos/pagos.routes.js';
import asistenciasRoutes from './modulos/asistencias/asistencias.routes.js';
import rutinasRoutes from './modulos/rutinas/rutinas.routes.js';

const app = express();

if (process.env.NODE_ENV === 'production') {
  // Configurar solo si el despliegue utiliza exactamente
  // un proxy de confianza delante de la aplicación.
  app.set('trust proxy', 1);
}

const origenesPermitidos = (
  process.env.FRONTEND_URL || 'http://localhost:5173'
)
  .split(',')
  .map((origen) => origen.trim())
  .filter(Boolean);

app.use(helmet());

app.use(cors({
  origin: (origen, callback) => {
    // Las solicitudes sin Origin pueden proceder de herramientas
    // de servidor o de línea de comandos.
    if (!origen || origenesPermitidos.includes(origen)) {
      return callback(null, true);
    }

    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true
}));

app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// Comprobación básica de disponibilidad del servidor HTTP.
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Servidor disponible'
  });
});

// Rutas de módulos
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/planes', planesRoutes);
app.use('/api/membresias', membresiasRoutes)
app.use('/api/pagos', pagosRoutes);
app.use('/api/asistencias', asistenciasRoutes);
app.use('/api/rutinas', rutinasRoutes);

// Respuesta para rutas inexistentes.
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Middleware centralizado de errores.
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const esErrorCors =
    err.message === 'Origen no permitido por CORS';

  const esJsonInvalido =
    err instanceof SyntaxError &&
    err.status === 400 &&
    err.type === 'entity.parse.failed';

  if (esJsonInvalido) {
    return res.status(400).json({
      success: false,
      message: 'El formato JSON enviado no es válido'
    });
  }

  if (esErrorCors) {
    return res.status(403).json({
      success: false,
      message: 'Origen no permitido'
    });
  }

  console.error('Error en la solicitud:', err.message);

  return res.status(500).json({
    success: false,
    message: 'Error interno del servidor'
  });
});

export default app;