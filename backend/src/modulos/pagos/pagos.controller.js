import { pool } from '../../db.js';
import {
    listarPagosSchema,
    obtenerPagoSchema,
    crearPagoSchema
} from './pagos.schemas.js';
import { crearNotificacion } from '../notificaciones/notificaciones.service.js';

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
        console.error('Error al revertir la transacción del pago:', error);
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
            estado,
            pagina,
            limite
        } = validacion.data;

        const condiciones = [];
        const valores = [];

        /*
         * Limito las consultas de clientes a los pagos asociados
         * a sus propias membresías, aunque modifiquen los filtros.
         */
        if (esClienteSinPermisosAdministrativos(req)) {
            valores.push(req.usuario.id);

            condiciones.push(`
                EXISTS (
                    SELECT 1
                    FROM membresias m
                    INNER JOIN clientes c ON c.id = m.cliente_id
                    WHERE m.id = p.membresia_id
                      AND c.usuario_id = $${valores.length}
                )
            `);
        }

        if (membresia_id) {
            valores.push(membresia_id);
            condiciones.push(`p.membresia_id = $${valores.length}`);
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(`p.estado = $${valores.length}`);
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
        const valoresPaginacion = [...valores, limite, offset];

        const consultaPagos = await pool.query(
            `SELECT
                p.id,
                p.membresia_id,
                p.monto,
                p.moneda,
                p.proveedor,
                p.medio_pago,
                p.estado,
                p.proveedor_pago_id,
                p.fecha_pago,
                p.created_at,
                p.updated_at
             FROM pagos p
             ${where}
             ORDER BY p.created_at DESC, p.id DESC
             LIMIT $${valoresPaginacion.length - 1}
             OFFSET $${valoresPaginacion.length}`,
            valoresPaginacion
        );

        return res.status(200).json({
            success: true,
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
                AND EXISTS (
                    SELECT 1
                    FROM membresias m
                    INNER JOIN clientes c ON c.id = m.cliente_id
                    WHERE m.id = p.membresia_id
                      AND c.usuario_id = $${valores.length}
                )
            `;
        }

        const resultado = await pool.query(
            `SELECT
                p.id,
                p.membresia_id,
                p.monto,
                p.moneda,
                p.proveedor,
                p.medio_pago,
                p.estado,
                p.proveedor_pago_id,
                p.fecha_pago,
                p.created_at,
                p.updated_at
             FROM pagos p
             WHERE p.id = $1
             ${condicionPropietario}
             LIMIT 1`,
            valores
        );

        if (resultado.rowCount === 0) {
            return responderError(res, 404, 'No se encontró el pago');
        }

        return res.status(200).json({
            success: true,
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
        /*
         * Verifico el permiso también dentro del controlador para
         * mantener una segunda barrera de autorización.
         */
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

        const { membresia_id, medio_pago } = validacion.data;

        cliente = await pool.connect();

        await cliente.query('BEGIN');
        transaccionIniciada = true;

        const resultadoMembresia = await cliente.query(
            `SELECT
                m.id,
                m.precio,
                m.moneda,
                m.estado,
                TO_CHAR(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin,
                c.usuario_id
             FROM membresias m
             INNER JOIN clientes c ON c.id = m.cliente_id
             WHERE m.id = $1
             FOR UPDATE OF m`,
            [membresia_id]
        );

        if (resultadoMembresia.rowCount === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                404,
                'No se encontró la membresía indicada'
            );
        }

        const membresia = resultadoMembresia.rows[0];

        if (membresia.estado !== 'ACTIVA') {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'Solo se pueden cobrar membresías activas'
            );
        }

        const resultadoVigencia = await cliente.query(
            `SELECT
                $1::DATE >= (
                    NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                )::DATE AS vigente`,
            [membresia.fecha_fin]
        );

        if (!resultadoVigencia.rows[0].vigente) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'No se pueden cobrar membresías vencidas'
            );
        }

        /*
         * La tabla pagos no admite montos iguales a cero.
         * Rechazo el cobro de planes gratuitos sin generar un error SQL.
         */
        if (Number(membresia.precio) <= 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'No se puede registrar un pago para una membresía sin costo'
            );
        }

        const resultadoPagoExistente = await cliente.query(
            `SELECT id
             FROM pagos
             WHERE membresia_id = $1
               AND estado = 'APROBADO'
             LIMIT 1`,
            [membresia_id]
        );

        if (resultadoPagoExistente.rowCount > 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'La membresía ya tiene un pago aprobado'
            );
        }

        const resultadoPago = await cliente.query(
            `INSERT INTO pagos (
                membresia_id,
                monto,
                moneda,
                proveedor,
                medio_pago,
                estado,
                fecha_pago
            )
            VALUES ($1, $2, $3, 'MANUAL', $4, 'APROBADO', NOW())
            RETURNING
                id,
                membresia_id,
                monto,
                moneda,
                proveedor,
                medio_pago,
                estado,
                proveedor_pago_id,
                fecha_pago,
                created_at,
                updated_at`,
            [
                membresia_id,
                membresia.precio,
                membresia.moneda,
                medio_pago
            ]
        );

        const pago = resultadoPago.rows[0];

        if (membresia.usuario_id) {
            await crearNotificacion({
                usuarioId: membresia.usuario_id,
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
        await revertirTransaccion(cliente, transaccionIniciada);

        return next(error);
    } finally {
        cliente?.release();
    }
};