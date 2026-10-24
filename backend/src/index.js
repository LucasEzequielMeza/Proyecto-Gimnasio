import 'dotenv/config';
import app from './app.js';
import { pool } from './db.js';
import { ejecutarMigraciones } from './utils/migraciones.js';

const PORT = Number(process.env.PORT) || 3000;

async function iniciarServidor() {
  try {
    /* Verifico que PostgreSQL responda antes de iniciar el servidor. */
    await pool.query('SELECT 1');

    console.log('Conexión con PostgreSQL establecida correctamente');

    /* Aplico las migraciones pendientes antes de aceptar solicitudes. */
    await ejecutarMigraciones();

    const server = app.listen(PORT, () => {
      console.log(`Servidor escuchando en el puerto ${PORT}`);
    });

    server.on('error', async (error) => {
      console.error('Error al iniciar el servidor:', error.message);
      await pool.end();
      process.exitCode = 1;
    });
  } catch (error) {
    console.error(
      'No se pudo iniciar el servidor:',
      error.message
    );

    await pool.end();
    process.exitCode = 1;
  }
}

iniciarServidor();