import { pool } from '../../db.js';

import {
    listarAsistenciasSchema,
    obtenerAsistenciaSchema,
    registrarAsistenciaSchema
} from './asistencias.schemas.js';

export const listarAsistencias = async (req, res, next) => {
    try {
        const validacion = listarAsistenciasSchema.safeParse(req.query);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los filtros de búsqueda no son válidos',
                errores: validacion.error.issues
            });
        }

        const {
            cliente_id,
            fecha_desde,
            fecha_hasta,
            pagina,
            limite
        } = validacion.data;

        const condiciones = [];
        const valores = [];

        if (cliente_id) {
            valores.push(cliente_id);
            condiciones.push(`a.cliente_id = $${valores.length}`);
        }

        if (fecha_desde) {
            valores.push(fecha_desde);
            condiciones.push(`a.fecha >= $${valores.length}::DATE`);
        }

        if (fecha_hasta) {
            valores.push(fecha_hasta);
            condiciones.push(`a.fecha <= $${valores.length}::DATE`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const resultadoTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM asistencias a
             ${where}`,
            valores
        );

        const total = resultadoTotal.rows[0].total;
        const desplazamiento = (pagina - 1) * limite;

        const valoresConsulta = [
            ...valores,
            limite,
            desplazamiento
        ];

        const resultado = await pool.query(
            `SELECT
                a.id,
                a.cliente_id,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                a.membresia_id,
                a.fecha,
                a.fecha_hora,
                a.registrado_por,
                u.nombre AS registrado_por_nombre,
                u.apellido AS registrado_por_apellido,
                a.observaciones,
                a.created_at
             FROM asistencias a
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN usuarios u ON u.id = a.registrado_por
             ${where}
             ORDER BY a.fecha_hora DESC, a.id DESC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            valoresConsulta
        );

        return res.status(200).json({
            asistencias: resultado.rows,
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

export const obtenerAsistencia = async (req, res, next) => {
    try {
        const validacion = obtenerAsistenciaSchema.safeParse(req.params);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'El identificador de la asistencia no es válido'
            });
        }

        const { id } = validacion.data;

        const resultado = await pool.query(
            `SELECT
                a.id,
                a.cliente_id,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                a.membresia_id,
                a.fecha,
                a.fecha_hora,
                a.registrado_por,
                u.nombre AS registrado_por_nombre,
                u.apellido AS registrado_por_apellido,
                a.observaciones,
                a.created_at
             FROM asistencias a
             INNER JOIN clientes c ON c.id = a.cliente_id
             INNER JOIN usuarios u ON u.id = a.registrado_por
             WHERE a.id = $1`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró la asistencia indicada'
            });
        }

        return res.status(200).json({
            asistencia: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const registrarAsistencia = async (req, res, next) => {
    let cliente;
    let transaccionIniciada = false;

    try {
        cliente = await pool.connect();

        const validacion = registrarAsistenciaSchema.safeParse(req.body);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los datos de la asistencia no son válidos',
                errores: validacion.error.issues
            });
        }

        const { cliente_id, observaciones } = validacion.data;
        const usuarioId = req.usuario?.id;

        if (!usuarioId) {
            return res.status(401).json({
                mensaje: 'No se pudo identificar al usuario autenticado'
            });
        }

        await cliente.query('BEGIN');
        transaccionIniciada = true;

        const resultadoCliente = await cliente.query(
            `SELECT id, estado
             FROM clientes
             WHERE id = $1
             FOR UPDATE`,
            [cliente_id]
        );

        if (resultadoCliente.rowCount === 0) {
            await cliente.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(404).json({
                mensaje: 'No se encontró el cliente indicado'
            });
        }

        if (resultadoCliente.rows[0].estado !== 'activo') {
            await cliente.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: 'No se puede registrar la asistencia de un cliente inactivo'
            });
        }

        const resultadoMembresia = await cliente.query(
            `SELECT id
             FROM membresias
             WHERE cliente_id = $1
               AND estado = 'ACTIVA'
               AND fecha_inicio <= (
                   NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
               )::DATE
               AND fecha_fin >= (
                   NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
               )::DATE
             ORDER BY fecha_fin DESC
             LIMIT 1`,
            [cliente_id]
        );

        if (resultadoMembresia.rowCount === 0) {
            await cliente.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: 'El cliente no tiene una membresía vigente'
            });
        }

        const membresiaId = resultadoMembresia.rows[0].id;

        const resultadoAsistencia = await cliente.query(
            `INSERT INTO asistencias (
                cliente_id,
                membresia_id,
                fecha,
                fecha_hora,
                registrado_por,
                observaciones
            )
            VALUES (
                $1,
                $2,
                (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE,
                NOW(),
                $3,
                $4
            )
            RETURNING
                id,
                cliente_id,
                membresia_id,
                fecha,
                fecha_hora,
                registrado_por,
                observaciones,
                created_at`,
            [
                cliente_id,
                membresiaId,
                usuarioId,
                observaciones ?? null
            ]
        );

        await cliente.query('COMMIT');
        transaccionIniciada = false;

        return res.status(201).json({
            mensaje: 'Asistencia registrada correctamente',
            asistencia: resultadoAsistencia.rows[0]
        });
    } catch (error) {
        if (cliente && transaccionIniciada) {
            await cliente.query('ROLLBACK').catch(() => {});
        }

        if (
            error.code === '23505' &&
            error.constraint === 'uq_asistencias_cliente_fecha'
        ) {
            return res.status(409).json({
                mensaje: 'El cliente ya tiene una asistencia registrada hoy'
            });
        }

        return next(error);
    } finally {
        cliente?.release();
    }
};