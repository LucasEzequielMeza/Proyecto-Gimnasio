import { pool } from '../../db.js';

const INTERVALO_VENCIMIENTOS_MS = 5 * 60 * 1000;
const DIAS_GRACIA_PAGO = 3;

let temporizador = null;
let ejecutando = false;
let detenido = false;

export async function actualizarMembresiasVencidas() {
    const resultadoVencidas = await pool.query(`
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

    const cantidadVencidas = resultadoVencidas.rowCount ?? 0;

    if (cantidadVencidas > 0) {
        console.log(
            `Membresías vencidas actualizadas: ${cantidadVencidas}`
        );
    }

    /*
     * Reactivo las membresías vencidas cuando existe una obligación
     * pagada cuyo período incluye la fecha actual.
     */
    const resultadoReactivadas = await pool.query(`
        WITH fecha_actual AS (
            SELECT (
                NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
            )::date AS hoy
        )
        UPDATE membresias AS m
        SET estado = 'ACTIVA',
            updated_at = NOW()
        FROM obligaciones_pago AS o,
             fecha_actual AS f
        WHERE o.membresia_id = m.id
          AND o.estado = 'PAGADA'
          AND o.periodo_inicio <= f.hoy
          AND o.periodo_fin >= f.hoy
          AND m.estado = 'VENCIDA'
        RETURNING m.id
    `);

    const cantidadReactivadas = resultadoReactivadas.rowCount ?? 0;

    if (cantidadReactivadas > 0) {
        console.log(
            `Membresías reactivadas: ${cantidadReactivadas}`
        );
    }

    return {
        vencidas: cantidadVencidas,
        reactivadas: cantidadReactivadas
    };
}

export async function actualizarObligacionesVencidas() {
    const resultado = await pool.query(`
        WITH fecha_actual AS (
            SELECT (
                NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
            )::date AS hoy
        )
        UPDATE obligaciones_pago AS o
        SET estado = 'VENCIDA',
            updated_at = NOW()
        FROM fecha_actual AS f
        WHERE o.estado = 'PENDIENTE'
          AND o.fecha_vencimiento + ${DIAS_GRACIA_PAGO} < f.hoy
        RETURNING o.id
    `);

    const cantidad = resultado.rowCount ?? 0;

    if (cantidad > 0) {
        console.log(
            `Obligaciones de pago vencidas actualizadas: ${cantidad}`
        );
    }

    return cantidad;
}

export async function generarObligacionesRenovacion() {
    const resultado = await pool.query(`
        WITH ultima_obligacion AS (
            SELECT DISTINCT ON (o.membresia_id)
                o.membresia_id,
                o.periodo_fin,
                o.estado
            FROM obligaciones_pago AS o
            ORDER BY
                o.membresia_id,
                o.periodo_inicio DESC
        ),
        siguientes_periodos AS (
            SELECT
                m.id AS membresia_id,
                (u.periodo_fin + 1)::date AS periodo_inicio,
                (
                    inicio_mes_destino
                    + (
                        LEAST(
                            EXTRACT(DAY FROM m.fecha_inicio)::INTEGER,
                            EXTRACT(
                                DAY FROM (
                                    inicio_mes_destino
                                    + INTERVAL '1 month'
                                    - INTERVAL '1 day'
                                )
                            )::INTEGER
                        ) - 1
                    ) * INTERVAL '1 day'
                    - INTERVAL '1 day'
                )::date AS periodo_fin,
                m.precio AS monto,
                m.moneda
            FROM membresias AS m
            INNER JOIN ultima_obligacion AS u
                ON u.membresia_id = m.id
            CROSS JOIN LATERAL (
                SELECT
                    (
                        DATE_TRUNC(
                            'month',
                            (u.periodo_fin + 1)::timestamp
                        )
                        + INTERVAL '1 month'
                    ) AS inicio_mes_destino
            ) AS calculo
            WHERE m.estado IN ('ACTIVA', 'VENCIDA')
              AND m.tipo_plan = 'MENSUAL'
              AND u.estado = 'PAGADA'
              AND NOT EXISTS (
                  SELECT 1
                  FROM obligaciones_pago AS existente
                  WHERE existente.membresia_id = m.id
                    AND existente.periodo_inicio = u.periodo_fin + 1
              )
        )
        INSERT INTO obligaciones_pago (
            membresia_id,
            periodo_inicio,
            periodo_fin,
            fecha_vencimiento,
            monto,
            moneda,
            estado
        )
        SELECT
            membresia_id,
            periodo_inicio,
            periodo_fin,
            periodo_inicio,
            monto,
            moneda,
            'PENDIENTE'
        FROM siguientes_periodos
        ON CONFLICT (membresia_id, periodo_inicio) DO NOTHING
        RETURNING id
    `);

    const cantidad = resultado.rowCount ?? 0;

    if (cantidad > 0) {
        console.log(
            `Obligaciones de renovación generadas: ${cantidad}`
        );
    }

    return cantidad;
}

async function ejecutarMantenimiento() {
    if (ejecutando || detenido) {
        return;
    }

    ejecutando = true;

    try {
        await actualizarMembresiasVencidas();
        await actualizarObligacionesVencidas();
        await generarObligacionesRenovacion();
    } catch (error) {
        console.error(
            'Error al ejecutar el mantenimiento de vencimientos:',
            error.message
        );
    } finally {
        ejecutando = false;
    }
}

export function iniciarProcesoVencimientos() {
    if (temporizador !== null) {
        return detenerProcesoVencimientos;
    }

    detenido = false;

    void ejecutarMantenimiento();

    temporizador = setInterval(() => {
        void ejecutarMantenimiento();
    }, INTERVALO_VENCIMIENTOS_MS);

    temporizador.unref();

    console.log(
        'Proceso de vencimientos y renovaciones iniciado. Intervalo: 5 minutos.'
    );

    return detenerProcesoVencimientos;
}

export function detenerProcesoVencimientos() {
    detenido = true;

    if (temporizador !== null) {
        clearInterval(temporizador);
        temporizador = null;
    }

    console.log(
        'Proceso de vencimientos y renovaciones detenido.'
    );
}