import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const variablesNecesarias = [
  'DB_HOST',
  'DB_PORT',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME'
];

const variablesFaltantes = variablesNecesarias.filter(
  (variable) => !process.env[variable]
);

if (variablesFaltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno para la base de datos: ${variablesFaltantes.join(', ')}`
  );
}

const puerto = Number(process.env.DB_PORT);

if (!Number.isInteger(puerto) || puerto < 1 || puerto > 65535) {
  throw new Error(
    'DB_PORT debe ser un puerto válido entre 1 y 65535'
  );
}

const requiereSSL = process.env.DB_SSL?.toLowerCase() === 'true';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: puerto,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: requiereSSL
    ? {
        rejectUnauthorized:
          process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      }
    : false,

  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  application_name: 'proyectogym'
});

pool.on('error', (error) => {
  console.error(
    'Error inesperado en el pool de PostgreSQL:',
    error.message
  );
});

export { pool };