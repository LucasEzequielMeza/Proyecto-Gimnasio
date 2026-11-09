import { pool } from '../../db.js';

import {
    listarObligacionesSchema,
    obtenerObligacionSchema
} from './obligaciones.schemas.js';

const tienePermiso = (req, permiso) => {
    return req.usuario?.permisos?.includes(permiso) ?? false;
};

/*
 * Considero administrativa una consulta cuando el usuario tiene
 * permisos para gestionar pagos u obligaciones de otros clientes.
 */
const puedeConsultarTodasLasObligaciones = (req) => {
    return tienePermiso(req, 'pagos.registrar')
        || tienePermiso(req, 'pagos.obligaciones.cancelar');
};

const responderError = (res, status, mensaje, errores) => {
    const respuesta = {
        success: false,
        mensaje
    };

    if (errores) {
        respuesta.errores = errores;
    }

    return res.status(status).json(respuesta);
};

const revertirTransaccion = async (cliente, transaccionIniciada) => {
    if (!cliente || !transaccionIniciada) return;

    try {
        await cliente.query('ROLLBACK');
    } catch (error) {
        console.error(
            'Error al revertir la transacción de la obligación:',
            error
        );
    }
};

export const listarObligaciones = async (req, res, next) => {
    try {
        const validacion = listarObligacionesSchema.safeParse(req.query);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'Los filtros de búsqueda no son válidos',
                validacion.error.issues
            );
        }

        const {
            membresia_id,
            estado,
            busqueda,
            pagina,
            limite
        } = validacion.data;

        const condiciones = [];
        const valores = [];

        const agregarCondicion = (condicion, valor) => {
            valores.push(valor);
            condiciones.push(
                condicion.replace('?', `$${valores.length}`)
            );
        };

        /*
         * Si no tiene permisos administrativos, limito la consulta
         * exclusivamente a las obligaciones de sus membresías.
         */
        if (!puedeConsultarTodasLasObligaciones(req)) {
            agregarCondicion(
                'c.usuario_id = ?',
                req.usuario.id
            );
        }

        if (membresia_id) {
            agregarCondicion(
                'o.membresia_id = ?',
                membresia_id
            );
        }

        if (estado) {
            agregarCondicion('o.estado = ?', estado);
        }

        if (busqueda) {
            valores.push(`%${busqueda}%`);
            const parametro = `$${valores.length}`;

            condiciones.push(`(
                c.nombre ILIKE ${parametro}
                OR c.apellido ILIKE ${parametro}
                OR CONCAT(c.nombre, ' ', c.apellido) ILIKE ${parametro}
                OR p.nombre ILIKE ${parametro}
            )`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const consultaTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM obligaciones_pago o
             INNER JOIN membresias m ON m.id = o.membresia_id
             INNER JOIN clientes c ON c.id = m.cliente_id
             INNER JOIN planes p ON p.id = m.plan_id
             ${where}`,
            valores
        );

        const total = consultaTotal.rows[0].total;
        const offset = (pagina - 1) * limite;

        const consulta = await pool.query(
            `SELECT
                o.id,
                o.membresia_id,
                o.periodo_inicio,
                o.periodo_fin,
                o.fecha_vencimiento,
                o.monto,
                o.moneda,
                o.estado,
                o.created_at,
                o.updated_at,
                c.id AS cliente_id,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                p.nombre AS plan_nombre,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM pagos pa
                    WHERE pa.obligacion_id = o.id
                ) AS cantidad_pagos,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM pagos pa
                    WHERE pa.obligacion_id = o.id
                      AND pa.estado = 'APROBADO'
                ) AS pagos_aprobados
             FROM obligaciones_pago o
             INNER JOIN membresias m ON m.id = o.membresia_id
             INNER JOIN clientes c ON c.id = m.cliente_id
             INNER JOIN planes p ON p.id = m.plan_id
             ${where}
             ORDER BY
                CASE o.estado
                    WHEN 'VENCIDA' THEN 1
                    WHEN 'PENDIENTE' THEN 2
                    WHEN 'PAGADA' THEN 3
                    WHEN 'CANCELADA' THEN 4
                END,
                o.fecha_vencimiento ASC,
                o.created_at DESC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            [...valores, limite, offset]
        );

        return res.status(200).json({
            success: true,
            mensaje: 'Obligaciones obtenidas correctamente',
            obligaciones: consulta.rows,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const obtenerObligacion = async (req, res, next) => {
    try {
        const validacion = obtenerObligacionSchema.safeParse(req.params);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'El identificador de la obligación no es válido',
                validacion.error.issues
            );
        }

        const valores = [validacion.data.id];
        let condicionPropietario = '';

        if (!puedeConsultarTodasLasObligaciones(req)) {
            valores.push(req.usuario.id);

            condicionPropietario = `
                AND c.usuario_id = $${valores.length}
            `;
        }

        const resultado = await pool.query(
            `SELECT
                o.id,
                o.membresia_id,
                o.periodo_inicio,
                o.periodo_fin,
                o.fecha_vencimiento,
                o.monto,
                o.moneda,
                o.estado,
                o.created_at,
                o.updated_at,
                c.id AS cliente_id,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                c.email AS cliente_email,
                p.nombre AS plan_nombre
             FROM obligaciones_pago o
             INNER JOIN membresias m ON m.id = o.membresia_id
             INNER JOIN clientes c ON c.id = m.cliente_id
             INNER JOIN planes p ON p.id = m.plan_id
             WHERE o.id = $1
             ${condicionPropietario}
             LIMIT 1`,
            valores
        );

        if (resultado.rowCount === 0) {
            return responderError(
                res,
                404,
                'No se encontró la obligación'
            );
        }

        const consultaPagos = await pool.query(
            `SELECT
                id,
                membresia_id,
                obligacion_id,
                monto,
                moneda,
                proveedor,
                medio_pago,
                estado,
                proveedor_pago_id,
                fecha_pago,
                created_at,
                updated_at
             FROM pagos
             WHERE obligacion_id = $1
             ORDER BY created_at DESC, id DESC`,
            [validacion.data.id]
        );

        return res.status(200).json({
            success: true,
            mensaje: 'Obligación obtenida correctamente',
            obligacion: {
                ...resultado.rows[0],
                pagos: consultaPagos.rows
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const cancelarObligacion = async (req, res, next) => {
    let cliente;
    let transaccionIniciada = false;

    try {
        if (!tienePermiso(req, 'pagos.obligaciones.cancelar')) {
            return responderError(
                res,
                403,
                'No tenés permiso para cancelar obligaciones de pago'
            );
        }

        const validacion = obtenerObligacionSchema.safeParse(req.params);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'El identificador de la obligación no es válido',
                validacion.error.issues
            );
        }

        cliente = await pool.connect();

        await cliente.query('BEGIN');
        transaccionIniciada = true;

        const resultado = await cliente.query(
            `SELECT id, estado
             FROM obligaciones_pago
             WHERE id = $1
             FOR UPDATE`,
            [validacion.data.id]
        );

        if (resultado.rowCount === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                404,
                'No se encontró la obligación'
            );
        }

        const obligacion = resultado.rows[0];

        if (!['PENDIENTE', 'VENCIDA'].includes(obligacion.estado)) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                obligacion.estado === 'PAGADA'
                    ? 'No se puede cancelar una obligación pagada'
                    : 'La obligación ya se encuentra cancelada'
            );
        }

        const resultadoPagoAprobado = await cliente.query(
            `SELECT id
             FROM pagos
             WHERE obligacion_id = $1
               AND estado = 'APROBADO'
             LIMIT 1`,
            [obligacion.id]
        );

        if (resultadoPagoAprobado.rowCount > 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'No se puede cancelar una obligación que tiene un pago aprobado'
            );
        }

        const actualizacion = await cliente.query(
            `UPDATE obligaciones_pago
             SET estado = 'CANCELADA',
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [obligacion.id]
        );

        await cliente.query('COMMIT');
        transaccionIniciada = false;

        return res.status(200).json({
            success: true,
            mensaje: 'Obligación cancelada correctamente',
            obligacion: actualizacion.rows[0]
        });
    } catch (error) {
        await revertirTransaccion(cliente, transaccionIniciada);
        return next(error);
    } finally {
        cliente?.release();
    }
};