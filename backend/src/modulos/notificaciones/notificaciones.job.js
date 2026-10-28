import cron from 'node-cron';

import { pool } from '../../db.js';
import { crearNotificacion } from './notificaciones.service.js';

const DIAS_ANTICIPACION = [3, 1, 0];

const generarNotificacionesVencimiento = async () => {
    for (const dias of DIAS_ANTICIPACION) {
        const resultado = await pool.query(
            `SELECT
                m.id AS membresia_id,
                m.fecha_fin,
                c.usuario_id
             FROM membresias m
             INNER JOIN clientes c ON c.id = m.cliente_id
             WHERE m.estado = 'ACTIVA'
               AND c.usuario_id IS NOT NULL
               AND m.fecha_fin =
                   (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
                   + $1::INTEGER`,
            [dias]
        );

        for (const membresia of resultado.rows) {
            const fechaFin = String(membresia.fecha_fin).slice(0, 10);

            const mensaje = dias === 0
                ? `Tu membresía vence hoy, ${fechaFin}.`
                : `Tu membresía vence en ${dias} ${
                    dias === 1 ? 'día' : 'días'
                }, el ${fechaFin}.`;

            await crearNotificacion({
                usuarioId: membresia.usuario_id,
                tipo: 'VENCIMIENTO',
                titulo: dias === 0
                    ? 'Tu membresía vence hoy'
                    : 'Próximo vencimiento de membresía',
                mensaje,
                entidadTipo: 'membresia',
                entidadId: membresia.membresia_id,
                claveUnica:
                    `membresia:${membresia.membresia_id}:vencimiento-${dias}-dias`
            });
        }
    }
};

export const iniciarJobNotificaciones = () => {
    const tarea = cron.schedule(
        '0 9 * * *',
        async () => {
            try {
                await generarNotificacionesVencimiento();
            } catch (error) {
                console.error(
                    'Error al generar notificaciones de vencimiento:',
                    error
                );
            }
        },
        {
            timezone: 'America/Argentina/Buenos_Aires'
        }
    );

    return () => tarea.stop();
};