import { pool } from '../../db.js';

import {
    listarPagosSchema,
    obtenerPagoSchema,
    crearPagoSchema
} from './pagos.schemas.js';

import {
    registrarPagoManual
} from './pagos.service.js';

import {
    crearNotificacion
} from '../notificaciones/notificaciones.service.js';

const esClienteSinPermisosAdministrativos = (req) => {
    const roles = req.usuario?.roles ?? [];

    return roles.includes('CLIENTE')
        && !roles.includes('ADMIN')
        && !roles.includes('RECEPCION');
};

const tienePermiso = (req, permiso) => {
    return req.usuario?.permisos?.includes(permiso) ?? false;
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
    if (!cliente || !transaccionIniciada) {
        return;
    }

    try {
        await cliente.query('ROLLBACK');
    } catch (error) {
        console.error(
            'Error al revertir la transacción del pago:',
            error
        );
    }
};

export const listarPagos = async (req, res, next) => {
    try {
        const validacion = listarPagosSchema.safeParse(req.query);

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
            obligacion_id,
            estado,
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
         * Limito las consultas de clientes a sus propios pagos,
         * aunque intenten modificar los filtros enviados.
         */
        if (esClienteSinPermisosAdministrativos(req)) {
            agregarCondicion(
                `EXISTS (
                    SELECT 1
                    FROM membresias m
                    INNER JOIN clientes c ON c.id = m.cliente_id
                    WHERE m.id = p.membresia_id
                      AND c.usuario_id = ?
                )`,
                req.usuario.id
            );
        }

        if (membresia_id) {
            agregarCondicion(
                'p.membresia_id = ?',
                membresia_id
            );
        }

        if (obligacion_id) {
            agregarCondicion(
                'p.obligacion_id = ?',
                obligacion_id
            );
        }

        if (estado) {
            agregarCondicion(
                'p.estado = ?',
                estado
            );
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const consultaTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM pagos p
             ${where}`,
            valores
        );

        const total = consultaTotal.rows[0].total;
        const offset = (pagina - 1) * limite;

        const valoresPaginacion = [
            ...valores,
            limite,
            offset
        ];

        const consultaPagos = await pool.query(
            `SELECT
                p.id,
                p.membresia_id,
                p.obligacion_id,
                p.monto,
                p.moneda,
                p.proveedor,
                p.medio_pago,
                p.estado,
                p.proveedor_pago_id,
                p.fecha_pago,
                p.created_at,
                p.updated_at,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                o.periodo_inicio,
                o.periodo_fin,
                o.fecha_vencimiento
             FROM pagos p
             INNER JOIN membresias m
                ON m.id = p.membresia_id
             INNER JOIN clientes c
                ON c.id = m.cliente_id
             LEFT JOIN obligaciones_pago o
                ON o.id = p.obligacion_id
             ${where}
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            valoresPaginacion
        );

        return res.status(200).json({
            success: true,
            mensaje: 'Pagos obtenidos correctamente',
            pagos: consultaPagos.rows,
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

export const obtenerPago = async (req, res, next) => {
    try {
        const validacion = obtenerPagoSchema.safeParse(req.params);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'El identificador del pago no es válido',
                validacion.error.issues
            );
        }

        const valores = [validacion.data.id];
        let condicionPropietario = '';

        if (esClienteSinPermisosAdministrativos(req)) {
            valores.push(req.usuario.id);

            condicionPropietario = `
                AND c.usuario_id = $${valores.length}
            `;
        }

        const resultado = await pool.query(
            `SELECT
                p.id,
                p.membresia_id,
                p.obligacion_id,
                p.monto,
                p.moneda,
                p.proveedor,
                p.medio_pago,
                p.estado,
                p.proveedor_pago_id,
                p.fecha_pago,
                p.created_at,
                p.updated_at,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                o.periodo_inicio,
                o.periodo_fin,
                o.fecha_vencimiento,
                o.estado AS estado_obligacion
             FROM pagos p
             INNER JOIN membresias m
                ON m.id = p.membresia_id
             INNER JOIN clientes c
                ON c.id = m.cliente_id
             LEFT JOIN obligaciones_pago o
                ON o.id = p.obligacion_id
             WHERE p.id = $1
             ${condicionPropietario}
             LIMIT 1`,
            valores
        );

        if (resultado.rowCount === 0) {
            return responderError(
                res,
                404,
                'No se encontró el pago'
            );
        }

        return res.status(200).json({
            success: true,
            mensaje: 'Pago obtenido correctamente',
            pago: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const crearPago = async (req, res, next) => {
    let cliente;
    let transaccionIniciada = false;

    try {
        if (!tienePermiso(req, 'pagos.registrar')) {
            return responderError(
                res,
                403,
                'No tenés permiso para registrar pagos'
            );
        }

        const validacion = crearPagoSchema.safeParse(req.body);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'Los datos del pago no son válidos',
                validacion.error.issues
            );
        }

        const {
            obligacion_id,
            medio_pago
        } = validacion.data;

        cliente = await pool.connect();

        await cliente.query('BEGIN');
        transaccionIniciada = true;

        /*
         * Bloqueo la obligación para impedir que dos empleados
         * puedan registrar simultáneamente el mismo cobro.
         */
        const resultadoObligacion = await cliente.query(
            `SELECT
                o.id,
                o.membresia_id,
                o.periodo_inicio,
                o.periodo_fin,
                o.monto,
                o.moneda,
                o.estado,
                m.fecha_fin AS membresia_fecha_fin,
                m.estado AS membresia_estado,
                c.usuario_id
            FROM obligaciones_pago o
            INNER JOIN membresias m
                ON m.id = o.membresia_id
            INNER JOIN clientes c
                ON c.id = m.cliente_id
            WHERE o.id = $1
            FOR UPDATE OF o`,
            [obligacion_id]
        );

        if (resultadoObligacion.rowCount === 0) {
            await revertirTransaccion(
                cliente,
                transaccionIniciada
            );
            transaccionIniciada = false;

            return responderError(
                res,
                404,
                'No se encontró la obligación de pago'
            );
        }

        const obligacion = resultadoObligacion.rows[0];

        if (!['PENDIENTE', 'VENCIDA'].includes(obligacion.estado)) {
            await revertirTransaccion(
                cliente,
                transaccionIniciada
            );
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                obligacion.estado === 'PAGADA'
                    ? 'Esta obligación ya fue pagada'
                    : 'No se puede cobrar una obligación cancelada'
            );
        }

        const resultadoPagoExistente = await cliente.query(
            `SELECT id
             FROM pagos
             WHERE obligacion_id = $1
               AND estado = 'APROBADO'
             LIMIT 1`,
            [obligacion.id]
        );

        if (resultadoPagoExistente.rowCount > 0) {
            await revertirTransaccion(
                cliente,
                transaccionIniciada
            );
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'La obligación ya tiene un pago aprobado'
            );
        }

        const pago = await registrarPagoManual(cliente, {
            obligacion,
            medio_pago
        });

        if (obligacion.usuario_id) {
            await crearNotificacion({
                usuarioId: obligacion.usuario_id,
                tipo: 'PAGO',
                titulo: 'Pago registrado correctamente',
                mensaje: `Se registró tu pago de ${pago.moneda} ${pago.monto}.`,
                entidadTipo: 'pago',
                entidadId: pago.id,
                claveUnica: `pago:${pago.id}:aprobado`,
                conexion: cliente
            });
        }

        await cliente.query('COMMIT');
        transaccionIniciada = false;

        return res.status(201).json({
            success: true,
            mensaje: 'Pago registrado correctamente',
            pago
        });
    } catch (error) {
        await revertirTransaccion(
            cliente,
            transaccionIniciada
        );

        return next(error);
    } finally {
        cliente?.release();
    }
};