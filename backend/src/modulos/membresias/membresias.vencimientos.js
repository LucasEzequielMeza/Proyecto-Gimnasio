import { pool } from '../../db.js';

const INTERVALO_VENCIMIENTOS_MS = 5 * 60 * 1000;

let temporizador = null;
let ejecutando = false;
let detenido = false;

/**
 * Persiste como VENCIDA toda membresía ACTIVA cuya fecha de fin
 * sea anterior a la fecha actual de Argentina.
 * Una membresía que vence hoy continúa vigente durante ese día.
 */
export async function actualizarMembresiasVencidas() {
    const resultado = await pool.query(`
        WITH fecha_actual AS (
            SELECT (
                NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
            )::date AS hoy
        )
        UPDATE membresias AS m
        SET estado = 'VENCIDA',
            updated_at = NOW()
        FROM fecha_actual AS f
        WHERE m.estado = 'ACTIVA'
          AND m.fecha_fin < f.hoy
        RETURNING m.id
    `);

    const cantidad = resultado.rowCount ?? 0;

    if (cantidad > 0) {
        console.log(
            `Membresías vencidas actualizadas: ${cantidad}`
        );
    }

    return cantidad;
}

/**
 * Ejecuta el mantenimiento sin permitir ejecuciones simultáneas
 * dentro de esta instancia del servidor.
 */
async function ejecutarMantenimiento() {
    if (ejecutando || detenido) {
        return;
    }

    ejecutando = true;

    try {
        await actualizarMembresiasVencidas();
    } catch (error) {
        console.error(
            'Error al actualizar membresías vencidas:',
            error.message
        );
    } finally {
        ejecutando = false;
    }
}

/**
 * Inicia una ejecución inmediata y después revisa periódicamente.
 * Devuelve una función para detener el proceso al apagar el servidor.
 */
export function iniciarProcesoVencimientos() {
    if (temporizador !== null) {
        return detenerProcesoVencimientos;
    }

    detenido = false;

    // Ejecuta el mantenimiento al iniciar, sin bloquear el servidor.
    void ejecutarMantenimiento();

    temporizador = setInterval(() => {
        void ejecutarMantenimiento();
    }, INTERVALO_VENCIMIENTOS_MS);

    // El temporizador no debe impedir que Node.js termine por sí solo.
    temporizador.unref();

    console.log(
        'Proceso de vencimientos iniciado. Intervalo: 5 minutos.'
    );

    return detenerProcesoVencimientos;
}

/**
 * Detiene las ejecuciones periódicas.
 */
export function detenerProcesoVencimientos() {
    detenido = true;

    if (temporizador !== null) {
        clearInterval(temporizador);
        temporizador = null;
    }

    console.log('Proceso de vencimientos detenido.');
}