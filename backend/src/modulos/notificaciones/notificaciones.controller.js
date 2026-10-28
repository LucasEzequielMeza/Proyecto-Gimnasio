import { pool } from '../../db.js';

import {
    listarNotificacionesSchema,
    obtenerNotificacionSchema
} from './notificaciones.schemas.js';

export const listarNotificaciones = async (req, res, next) => {
    try {
        const validacion = listarNotificacionesSchema.safeParse(req.query);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los filtros de notificaciones no son válidos',
                errores: validacion.error.issues
            });
        }

        const {
            estado,
            tipo,
            pagina,
            limite
        } = validacion.data;

        const condiciones = ['usuario_id = $1'];
        const valores = [req.usuario.id];

        if (estado === 'leidas') {
            condiciones.push('leida_at IS NOT NULL');
        } else if (estado === 'no_leidas') {
            condiciones.push('leida_at IS NULL');
        }

        if (tipo) {
            valores.push(tipo);
            condiciones.push(`tipo = $${valores.length}`);
        }

        const where = `WHERE ${condiciones.join(' AND ')}`;

        const resultadoTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM notificaciones
             ${where}`,
            valores
        );

        const total = resultadoTotal.rows[0].total;
        const desplazamiento = (pagina - 1) * limite;

        const resultadoNoLeidas = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM notificaciones
             WHERE usuario_id = $1
               AND leida_at IS NULL`,
            [req.usuario.id]
        );

        const valoresConsulta = [
            ...valores,
            limite,
            desplazamiento
        ];

        const resultado = await pool.query(
            `SELECT
                id,
                tipo,
                titulo,
                mensaje,
                entidad_tipo,
                entidad_id,
                leida_at,
                expira_at,
                created_at
             FROM notificaciones
             ${where}
             ORDER BY created_at DESC, id DESC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            valoresConsulta
        );

        return res.status(200).json({
            notificaciones: resultado.rows,
            noLeidas: resultadoNoLeidas.rows[0].total,
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

export const marcarNotificacionLeida = async (req, res, next) => {
    try {
        const validacion = obtenerNotificacionSchema.safeParse(req.params);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'El identificador de la notificación no es válido'
            });
        }

        const { id } = validacion.data;

        const resultado = await pool.query(
            `UPDATE notificaciones
             SET leida_at = COALESCE(leida_at, NOW())
             WHERE id = $1
               AND usuario_id = $2
             RETURNING
                id,
                tipo,
                titulo,
                mensaje,
                entidad_tipo,
                entidad_id,
                leida_at,
                expira_at,
                created_at`,
            [id, req.usuario.id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró la notificación indicada'
            });
        }

        return res.status(200).json({
            mensaje: 'Notificación marcada como leída',
            notificacion: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const marcarTodasLeidas = async (req, res, next) => {
    try {
        const resultado = await pool.query(
            `UPDATE notificaciones
             SET leida_at = NOW()
             WHERE usuario_id = $1
               AND leida_at IS NULL`,
            [req.usuario.id]
        );

        return res.status(200).json({
            mensaje: 'Notificaciones marcadas como leídas',
            cantidad: resultado.rowCount
        });
    } catch (error) {
        return next(error);
    }
};

export const eliminarNotificacion = async (req, res, next) => {
    try {
        const validacion = obtenerNotificacionSchema.safeParse(req.params);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'El identificador de la notificación no es válido'
            });
        }

        const { id } = validacion.data;

        const resultado = await pool.query(
            `DELETE FROM notificaciones
             WHERE id = $1
               AND usuario_id = $2
             RETURNING id`,
            [id, req.usuario.id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró la notificación indicada'
            });
        }

        return res.status(200).json({
            mensaje: 'Notificación eliminada correctamente'
        });
    } catch (error) {
        return next(error);
    }
};