import { pool } from '../../db.js';

import {
    listarPlanesSchema,
    idPlanSchema,
    crearPlanSchema,
    editarPlanSchema,
    cambiarEstadoPlanSchema
} from './planes.schemas.js';

// --------------------------------------------------
// Respuestas comunes
// --------------------------------------------------

const responderValidacion = (res, error, mensaje) => {
    return res.status(400).json({
        success: false,
        message: mensaje,
        errores: error.issues.map((issue) => ({
            campo: issue.path.join('.'),
            mensaje: issue.message
        }))
    });
};

const responderErrorServidor = (res) => {
    return res.status(500).json({
        success: false,
        message: 'Ocurrió un error interno al procesar la solicitud'
    });
};

const responderPlanNoEncontrado = (res) => {
    return res.status(404).json({
        success: false,
        message: 'El plan solicitado no existe'
    });
};

const responderNombreDuplicado = (res) => {
    return res.status(409).json({
        success: false,
        message: 'Ya existe un plan con ese nombre'
    });
};

const manejarErrorBaseDatos = (res, error) => {
    if (error.code === '23505') {
        if (error.constraint === 'uq_planes_nombre') {
            return responderNombreDuplicado(res);
        }

        return res.status(409).json({
            success: false,
            message: 'El registro entra en conflicto con un dato existente'
        });
    }

    if (
        ['23514', '22007', '22008', '22P02'].includes(error.code)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Los datos enviados no son válidos'
        });
    }

    console.error('Error en el módulo de planes:', error);
    return responderErrorServidor(res);
};

// --------------------------------------------------
// GET /api/planes
// Listar planes con búsqueda y paginación
// --------------------------------------------------

export const listarPlanes = async (req, res) => {
    const validacion = listarPlanesSchema.safeParse(req.query);

    if (!validacion.success) {
        return responderValidacion(
            res,
            validacion.error,
            'Los parámetros de búsqueda no son válidos'
        );
    }

    const { pagina, limite, busqueda, estado, tipo } = validacion.data;
    const offset = (pagina - 1) * limite;

    const condiciones = [];
    const valores = [];

    if (busqueda) {
        valores.push(`%${busqueda}%`);
        condiciones.push(
            `(nombre ILIKE $${valores.length} OR descripcion ILIKE $${valores.length})`
        );
    }

    if (estado) {
        valores.push(estado);
        condiciones.push(`estado = $${valores.length}`);
    }

    if (tipo) {
        valores.push(tipo);
        condiciones.push(`tipo = $${valores.length}`);
    }

    const where =
        condiciones.length > 0
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

    try {
        const consultaTotal = await pool.query(
            `SELECT COUNT(*) AS total
             FROM planes
             ${where}`,
            valores
        );

        const total = Number(consultaTotal.rows[0].total);

        const consultaPlanes = await pool.query(
            `SELECT
                id,
                nombre,
                descripcion,
                precio,
                moneda,
                tipo,
                duracion_dias,
                estado,
                created_at,
                updated_at
             FROM planes
             ${where}
             ORDER BY created_at DESC, id DESC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            [...valores, limite, offset]
        );

        return res.status(200).json({
            success: true,
            message: 'Planes obtenidos correctamente',
            data: consultaPlanes.rows,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });
    } catch (error) {
        return manejarErrorBaseDatos(res, error);
    }
};

// --------------------------------------------------
// GET /api/planes/:id
// Obtener un plan
// --------------------------------------------------

export const obtenerPlan = async (req, res) => {
    const validacion = idPlanSchema.safeParse(req.params.id);

    if (!validacion.success) {
        return responderValidacion(
            res,
            validacion.error,
            'El identificador del plan no es válido'
        );
    }

    try {
        const resultado = await pool.query(
            `SELECT
                id,
                nombre,
                descripcion,
                precio,
                moneda,
                tipo,
                duracion_dias,
                estado,
                created_at,
                updated_at
             FROM planes
             WHERE id = $1`,
            [validacion.data]
        );

        if (resultado.rowCount === 0) {
            return responderPlanNoEncontrado(res);
        }

        return res.status(200).json({
            success: true,
            message: 'Plan obtenido correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        return manejarErrorBaseDatos(res, error);
    }
};

// --------------------------------------------------
// POST /api/planes
// Crear un plan
// --------------------------------------------------

export const crearPlan = async (req, res) => {
    const validacion = crearPlanSchema.safeParse(req.body);

    if (!validacion.success) {
        return responderValidacion(
            res,
            validacion.error,
            'Los datos del plan no son válidos'
        );
    }

    const {
        nombre,
        descripcion,
        precio,
        moneda,
        tipo,
        duracion_dias
    } = validacion.data;

    try {
        const resultado = await pool.query(
            `INSERT INTO planes (
                nombre,
                descripcion,
                precio,
                moneda,
                tipo,
                duracion_dias
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
                id,
                nombre,
                descripcion,
                precio,
                moneda,
                tipo,
                duracion_dias,
                estado,
                created_at,
                updated_at`,
            [
                nombre,
                descripcion ?? null,
                precio,
                moneda,
                tipo,
                tipo === 'MENSUAL' ? null : duracion_dias
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Plan creado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        return manejarErrorBaseDatos(res, error);
    }
};

// --------------------------------------------------
// PATCH /api/planes/:id
// Editar un plan
// --------------------------------------------------

export const editarPlan = async (req, res) => {
    const validacionId = idPlanSchema.safeParse(req.params.id);

    if (!validacionId.success) {
        return responderValidacion(
            res,
            validacionId.error,
            'El identificador del plan no es válido'
        );
    }

    const validacion = editarPlanSchema.safeParse(req.body);

    if (!validacion.success) {
        return responderValidacion(
            res,
            validacion.error,
            'Los datos del plan no son válidos'
        );
    }

    let cliente;

    try {
        cliente = await pool.connect();
        await cliente.query('BEGIN');

        const id = validacionId.data;
        const datos = validacion.data;

        const consultaActual = await cliente.query(
            `SELECT id, tipo, duracion_dias
             FROM planes
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (consultaActual.rowCount === 0) {
            await cliente.query('ROLLBACK');
            return responderPlanNoEncontrado(res);
        }

        const planActual = consultaActual.rows[0];
        const tipoFinal = datos.tipo ?? planActual.tipo;

        let duracionFinal =
            datos.duracion_dias !== undefined
                ? datos.duracion_dias
                : planActual.duracion_dias;

        if (tipoFinal === 'MENSUAL') {
            if (
                datos.duracion_dias !== undefined &&
                datos.duracion_dias !== null
            ) {
                await cliente.query('ROLLBACK');

                return res.status(400).json({
                    success: false,
                    message: 'Los planes mensuales no deben tener duración en días',
                    errores: [
                        {
                            campo: 'duracion_dias',
                            mensaje:
                                'La duración debe omitirse o ser null para los planes mensuales'
                        }
                    ]
                });
            }

            duracionFinal = null;
        }

        if (tipoFinal === 'FIJO' && duracionFinal == null) {
            await cliente.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'Los planes fijos deben tener una duración mayor que cero',
                errores: [
                    {
                        campo: 'duracion_dias',
                        mensaje:
                            'La duración en días es obligatoria para los planes fijos'
                    }
                ]
            });
        }

        const camposPermitidos = [
            'nombre',
            'descripcion',
            'precio',
            'moneda'
        ];

        const asignaciones = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (datos[campo] !== undefined) {
                valores.push(datos[campo]);
                asignaciones.push(`${campo} = $${valores.length}`);
            }
        }

        if (datos.tipo !== undefined) {
            valores.push(tipoFinal);
            asignaciones.push(`tipo = $${valores.length}`);
        }

        if (
            datos.duracion_dias !== undefined ||
            (datos.tipo !== undefined && tipoFinal === 'MENSUAL')
        ) {
            valores.push(duracionFinal);
            asignaciones.push(`duracion_dias = $${valores.length}`);
        }

        if (asignaciones.length === 0) {
            await cliente.query('ROLLBACK');

            return res.status(400).json({
                success: false,
                message: 'No hay cambios válidos para aplicar'
            });
        }

        valores.push(id);

        const resultado = await cliente.query(
            `UPDATE planes
             SET ${asignaciones.join(', ')},
                 updated_at = NOW()
             WHERE id = $${valores.length}
             RETURNING
                id,
                nombre,
                descripcion,
                precio,
                moneda,
                tipo,
                duracion_dias,
                estado,
                created_at,
                updated_at`,
            valores
        );

        await cliente.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Plan actualizado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        if (cliente) {
            try {
                await cliente.query('ROLLBACK');
            } catch (errorRollback) {
                console.error(
                    'Error al revertir la edición del plan:',
                    errorRollback
                );
            }
        }

        return manejarErrorBaseDatos(res, error);
    } finally {
        cliente?.release();
    }
};

// --------------------------------------------------
// PATCH /api/planes/:id/estado
// Activar o desactivar un plan
// --------------------------------------------------

export const cambiarEstadoPlan = async (req, res) => {
    const validacionId = idPlanSchema.safeParse(req.params.id);

    if (!validacionId.success) {
        return responderValidacion(
            res,
            validacionId.error,
            'El identificador del plan no es válido'
        );
    }

    const validacion = cambiarEstadoPlanSchema.safeParse(req.body);

    if (!validacion.success) {
        return responderValidacion(
            res,
            validacion.error,
            'El estado del plan no es válido'
        );
    }

    try {
        const resultado = await pool.query(
            `UPDATE planes
             SET estado = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING
                id,
                nombre,
                descripcion,
                precio,
                moneda,
                tipo,
                duracion_dias,
                estado,
                created_at,
                updated_at`,
            [validacion.data.estado, validacionId.data]
        );

        if (resultado.rowCount === 0) {
            return responderPlanNoEncontrado(res);
        }

        return res.status(200).json({
            success: true,
            message:
                validacion.data.estado === 'activo'
                    ? 'Plan activado correctamente'
                    : 'Plan desactivado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        return manejarErrorBaseDatos(res, error);
    }
};