import 'dotenv/config';
import app from './app.js';
import { pool } from './db.js';
import { ejecutarMigraciones } from './utils/migraciones.js';
import { iniciarProcesoVencimientos } from './modulos/membresias/membresias.vencimientos.js';
import { iniciarJobNotificaciones } from './modulos/notificaciones/notificaciones.job.js';

const PORT = Number(process.env.PORT) || 3000;

let server;
let detenerProcesoVencimientos;
let detenerJobNotificaciones;
let cerrando = false;

const cerrarServidor = async (codigoSalida = 0) => {
    if (cerrando) return;

    cerrando = true;
    process.exitCode = codigoSalida;

    console.log('Cerrando servidor...');

    detenerProcesoVencimientos?.();
    detenerJobNotificaciones?.();

    if (server) {
        await new Promise((resolve) => {
            server.close(resolve);
        });
    }

    try {
        await pool.end();
        console.log('Conexión con PostgreSQL cerrada.');
    } catch (error) {
        console.error(
            'Error al cerrar PostgreSQL:',
            error.message
        );

        process.exitCode = 1;
    }
};

const iniciarServidor = async () => {
    try {
        await pool.query('SELECT 1');

        console.log(
            'Conexión con PostgreSQL establecida correctamente'
        );

        await ejecutarMigraciones();

        server = app.listen(PORT, () => {
            console.log(`Servidor escuchando en el puerto ${PORT}`);

            detenerProcesoVencimientos =
                iniciarProcesoVencimientos();

            detenerJobNotificaciones =
                iniciarJobNotificaciones();
        });

        server.on('error', (error) => {
            console.error(
                'Error en el servidor HTTP:',
                error.message
            );

            void cerrarServidor(1);
        });
    } catch (error) {
        console.error(
            'No se pudo iniciar el servidor:',
            error.message
        );

        await cerrarServidor(1);
    }
};

process.once('SIGINT', () => {
    void cerrarServidor(0);
});

process.once('SIGTERM', () => {
    void cerrarServidor(0);
});

iniciarServidor();