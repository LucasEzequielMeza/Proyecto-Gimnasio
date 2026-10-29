import { pool } from '../../db.js';

import {
    listarAsistenciasSchema,
    obtenerAsistenciaSchema,
    registrarAsistenciaSchema
} from './asistencias.schemas.js';

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
            'Error al revertir la transacción de asistencia:',
            error
        );
    }
};

export const listarAsistencias = async (req, res, next) => {
    try {
        if (!tienePermiso(req, 'asistencias.consultar')) {
            return responderError(
                res,
                403,
                'No tenés permiso para consultar asistencias'
            );
        }

        const validacion = listarAsistenciasSchema.safeParse(req.query);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'Los filtros de búsqueda no son válidos',
                validacion.error.issues
            );
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

        /*
         * Restringo las consultas de clientes a sus propias asistencias,
         * independientemente de los filtros que envíen.
         */
        if (esClienteSinPermisosAdministrativos(req)) {
            valores.push(req.usuario.id);

            condiciones.push(`
                EXISTS (
                    SELECT 1
                    FROM clientes cp
                    WHERE cp.id = a.cliente_id
                      AND cp.usuario_id = $${valores.length}
                )
            `);
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
            success: true,
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
        if (!tienePermiso(req, 'asistencias.consultar')) {
            return responderError(
                res,
                403,
                'No tenés permiso para consultar asistencias'
            );
        }

        const validacion = obtenerAsistenciaSchema.safeParse(req.params);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'El identificador de la asistencia no es válido',
                validacion.error.issues
            );
        }

        const id = validacion.data.id;
        const valores = [id];
        let condicionPropietario = '';

        if (esClienteSinPermisosAdministrativos(req)) {
            valores.push(req.usuario.id);

            condicionPropietario = `
                AND c.usuario_id = $${valores.length}
            `;
        }

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
             WHERE a.id = $1
             ${condicionPropietario}
             LIMIT 1`,
            valores
        );

        if (resultado.rowCount === 0) {
            return responderError(
                res,
                404,
                'No se encontró la asistencia indicada'
            );
        }

        return res.status(200).json({
            success: true,
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
        if (!tienePermiso(req, 'asistencias.registrar')) {
            return responderError(
                res,
                403,
                'No tenés permiso para registrar asistencias'
            );
        }

        /*
         * El registro se realiza desde recepción o administración.
         * No permito que una cuenta de cliente registre su propia entrada.
         */
        if (esClienteSinPermisosAdministrativos(req)) {
            return responderError(
                res,
                403,
                'Los clientes no pueden registrar asistencias directamente'
            );
        }

        const validacion = registrarAsistenciaSchema.safeParse(req.body);

        if (!validacion.success) {
            return responderError(
                res,
                400,
                'Los datos de la asistencia no son válidos',
                validacion.error.issues
            );
        }

        const { cliente_id, observaciones } = validacion.data;
        const usuarioId = req.usuario?.id;

        if (!usuarioId) {
            return responderError(
                res,
                401,
                'No se pudo identificar al usuario autenticado'
            );
        }

        cliente = await pool.connect();

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
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                404,
                'No se encontró el cliente indicado'
            );
        }

        if (resultadoCliente.rows[0].estado !== 'activo') {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'No se puede registrar la asistencia de un cliente inactivo'
            );
        }

        /*
         * Bloqueo la membresía seleccionada para evitar registrar la
         * asistencia mientras otra operación la cancela o modifica.
         */
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
             ORDER BY fecha_fin DESC, created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [cliente_id]
        );

        if (resultadoMembresia.rowCount === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'El cliente no tiene una membresía vigente'
            );
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
            success: true,
            mensaje: 'Asistencia registrada correctamente',
            asistencia: resultadoAsistencia.rows[0]
        });
    } catch (error) {
        await revertirTransaccion(cliente, transaccionIniciada);

        if (
            error.code === '23505' &&
            error.constraint === 'uq_asistencias_cliente_fecha'
        ) {
            return responderError(
                res,
                409,
                'El cliente ya tiene una asistencia registrada hoy'
            );
        }

        return next(error);
    } finally {
        cliente?.release();
    }
};