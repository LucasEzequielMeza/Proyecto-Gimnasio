import { pool } from '../../db.js';
import {
    listarPagosSchema,
    obtenerPagoSchema,
    crearPagoSchema
} from './pagos.schemas.js';
import { crearNotificacion } from '../notificaciones/notificaciones.service.js';

export const listarPagos = async (req, res, next) => {
    try {
        const validacion = listarPagosSchema.safeParse(req.query);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los filtros de búsqueda no son válidos',
                errores: validacion.error.issues
            });
        }

        const { membresia_id, estado, pagina, limite } = validacion.data;
        const condiciones = [];
        const valores = [];

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

        valores.push(limite, offset);

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
             LIMIT $${valores.length - 1}
             OFFSET $${valores.length}`,
            valores
        );

        return res.status(200).json({
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
            return res.status(400).json({
                mensaje: 'El identificador del pago no es válido',
                errores: validacion.error.issues
            });
        }

        const { id } = validacion.data;

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
             WHERE p.id = $1`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró el pago'
            });
        }

        return res.status(200).json({
            pago: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const crearPago = async (req, res, next) => {
    let cliente;

    try {
        const validacion = crearPagoSchema.safeParse(req.body);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los datos del pago no son válidos',
                errores: validacion.error.issues
            });
        }

        const { membresia_id, medio_pago } = validacion.data;

        cliente = await pool.connect();

        await cliente.query('BEGIN');

        const resultadoMembresia = await cliente.query(
            `SELECT
                m.id,
                m.precio,
                m.moneda,
                m.estado,
                m.fecha_fin,
                c.usuario_id,
                c.nombre,
                c.apellido
             FROM membresias m
             INNER JOIN clientes c ON c.id = m.cliente_id
             WHERE m.id = $1
             FOR UPDATE OF m`,
            [membresia_id]
        );

        if (resultadoMembresia.rowCount === 0) {
            await cliente.query('ROLLBACK');

            return res.status(404).json({
                mensaje: 'No se encontró la membresía indicada'
            });
        }

        const membresia = resultadoMembresia.rows[0];

        if (membresia.estado !== 'ACTIVA') {
            await cliente.query('ROLLBACK');

            return res.status(409).json({
                mensaje: 'Solo se pueden cobrar membresías activas'
            });
        }

        const resultadoVigencia = await cliente.query(
            `SELECT
                $1::DATE >= (
                    NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                )::DATE AS vigente`,
            [membresia.fecha_fin]
        );

        if (!resultadoVigencia.rows[0].vigente) {
            await cliente.query('ROLLBACK');

            return res.status(409).json({
                mensaje: 'No se pueden cobrar membresías vencidas'
            });
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
            await cliente.query('ROLLBACK');

            return res.status(409).json({
                mensaje: 'La membresía ya tiene un pago aprobado'
            });
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

        return res.status(201).json({
            mensaje: 'Pago registrado correctamente',
            pago
        });
    } catch (error) {
        if (cliente) {
            await cliente.query('ROLLBACK').catch(() => {});
        }

        return next(error);
    } finally {
        cliente?.release();
    }
};