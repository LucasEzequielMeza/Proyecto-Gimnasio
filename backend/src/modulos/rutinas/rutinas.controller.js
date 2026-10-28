import { pool } from '../../db.js';

import {
    listarRutinasSchema,
    obtenerRutinaSchema,
    crearRutinaSchema,
    editarRutinaSchema,
    cambiarEstadoRutinaSchema,
    asignarRutinaSchema
} from './rutinas.schemas.js';

const tieneRol = (req, rol) => req.usuario?.roles?.includes(rol);

const obtenerRutinaPorId = async (conexion, id, bloquear = false) => {
    const resultado = await conexion.query(
        `SELECT
            r.*,
            c.nombre AS cliente_nombre,
            c.apellido AS cliente_apellido,
            u.nombre AS entrenador_nombre,
            u.apellido AS entrenador_apellido
         FROM rutinas r
         INNER JOIN clientes c ON c.id = r.cliente_id
         INNER JOIN usuarios u ON u.id = r.entrenador_id
         WHERE r.id = $1
         ${bloquear ? 'FOR UPDATE OF r' : ''}`,
        [id]
    );

    return resultado.rows[0] ?? null;
};

const obtenerEjercicios = async (conexion, rutinaId) => {
    const resultado = await conexion.query(
        `SELECT
            id,
            rutina_id,
            nombre,
            descripcion,
            orden,
            series,
            repeticiones,
            descanso_segundos,
            observaciones,
            created_at
         FROM rutina_ejercicios
         WHERE rutina_id = $1
         ORDER BY orden ASC`,
        [rutinaId]
    );

    return resultado.rows;
};

const verificarAccesoRutina = async (conexion, req, rutinaId) => {
    const administrador = tieneRol(req, 'ADMIN');
    const entrenador = tieneRol(req, 'ENTRENADOR');
    const cliente = tieneRol(req, 'CLIENTE');

    let condicion;
    const valores = [rutinaId];

    if (administrador) {
        condicion = 'TRUE';
    } else if (entrenador) {
        valores.push(req.usuario.id);
        condicion = `r.entrenador_id = $${valores.length}`;
    } else if (cliente) {
        valores.push(req.usuario.id);
        condicion = `EXISTS (
            SELECT 1
            FROM clientes c
            WHERE c.id = r.cliente_id
              AND c.usuario_id = $${valores.length}
        )`;
    } else {
        return false;
    }

    const resultado = await conexion.query(
        `SELECT r.id
         FROM rutinas r
         WHERE r.id = $1
           AND ${condicion}`,
        valores
    );

    return resultado.rowCount > 0;
};

export const listarRutinas = async (req, res, next) => {
    try {
        const validacion = listarRutinasSchema.safeParse(req.query);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los filtros de búsqueda no son válidos',
                errores: validacion.error.issues
            });
        }

        const {
            cliente_id,
            entrenador_id,
            estado,
            pagina,
            limite
        } = validacion.data;

        const condiciones = [];
        const valores = [];

        if (tieneRol(req, 'CLIENTE')) {
            valores.push(req.usuario.id);

            condiciones.push(
                `EXISTS (
                    SELECT 1
                    FROM clientes c
                    WHERE c.id = r.cliente_id
                      AND c.usuario_id = $${valores.length}
                )`
            );
        } else if (
            tieneRol(req, 'ENTRENADOR') &&
            !tieneRol(req, 'ADMIN')
        ) {
            valores.push(req.usuario.id);
            condiciones.push(
                `r.entrenador_id = $${valores.length}`
            );
        }

        if (cliente_id) {
            valores.push(cliente_id);
            condiciones.push(
                `r.cliente_id = $${valores.length}`
            );
        }

        if (entrenador_id) {
            valores.push(entrenador_id);
            condiciones.push(
                `r.entrenador_id = $${valores.length}`
            );
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(
                `r.estado = $${valores.length}`
            );
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const resultadoTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM rutinas r
             ${where}`,
            valores
        );

        const total = resultadoTotal.rows[0].total;
        const desplazamiento = (pagina - 1) * limite;
        const valoresConsulta = [...valores, limite, desplazamiento];

        const resultado = await pool.query(
            `SELECT
                r.id,
                r.cliente_id,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                r.entrenador_id,
                u.nombre AS entrenador_nombre,
                u.apellido AS entrenador_apellido,
                r.nombre,
                r.objetivo,
                r.descripcion,
                r.fecha_inicio,
                r.fecha_fin,
                r.estado,
                r.created_at,
                r.updated_at
             FROM rutinas r
             INNER JOIN clientes c ON c.id = r.cliente_id
             INNER JOIN usuarios u ON u.id = r.entrenador_id
             ${where}
             ORDER BY r.created_at DESC, r.id DESC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            valoresConsulta
        );

        return res.status(200).json({
            rutinas: resultado.rows,
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

export const obtenerRutina = async (req, res, next) => {
    try {
        const validacion = obtenerRutinaSchema.safeParse(req.params);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'El identificador de la rutina no es válido'
            });
        }

        const { id } = validacion.data;

        const acceso = await verificarAccesoRutina(
            pool,
            req,
            id
        );

        if (!acceso) {
            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        const rutina = await obtenerRutinaPorId(pool, id);

        if (!rutina) {
            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        rutina.ejercicios = await obtenerEjercicios(pool, id);

        return res.status(200).json({ rutina });
    } catch (error) {
        return next(error);
    }
};

export const crearRutina = async (req, res, next) => {
    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.connect();

        const validacion = crearRutinaSchema.safeParse(req.body);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'Los datos de la rutina no son válidos',
                errores: validacion.error.issues
            });
        }

        const {
            cliente_id,
            nombre,
            objetivo,
            descripcion,
            fecha_inicio,
            fecha_fin,
            ejercicios
        } = validacion.data;

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        const resultadoCliente = await conexion.query(
            `SELECT id, estado
             FROM clientes
             WHERE id = $1
             FOR UPDATE`,
            [cliente_id]
        );

        if (resultadoCliente.rowCount === 0) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(404).json({
                mensaje: 'No se encontró el cliente indicado'
            });
        }

        if (resultadoCliente.rows[0].estado !== 'activo') {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: 'No se puede asignar una rutina a un cliente inactivo'
            });
        }

        const resultadoRutina = await conexion.query(
            `INSERT INTO rutinas (
                cliente_id,
                entrenador_id,
                nombre,
                objetivo,
                descripcion,
                fecha_inicio,
                fecha_fin
            )
            VALUES (
                $1, $2, $3, $4, $5,
                COALESCE(
                    $6::DATE,
                    (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
                ),
                $7
            )
            RETURNING *`,
            [
                cliente_id,
                req.usuario.id,
                nombre,
                objetivo,
                descripcion,
                fecha_inicio ?? null,
                fecha_fin ?? null
            ]
        );

        const rutina = resultadoRutina.rows[0];

        for (const ejercicio of ejercicios) {
            await conexion.query(
                `INSERT INTO rutina_ejercicios (
                    rutina_id,
                    nombre,
                    descripcion,
                    orden,
                    series,
                    repeticiones,
                    descanso_segundos,
                    observaciones
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    rutina.id,
                    ejercicio.nombre,
                    ejercicio.descripcion,
                    ejercicio.orden,
                    ejercicio.series,
                    ejercicio.repeticiones,
                    ejercicio.descanso_segundos,
                    ejercicio.observaciones
                ]
            );
        }

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        rutina.ejercicios = await obtenerEjercicios(
            pool,
            rutina.id
        );

        return res.status(201).json({
            mensaje: 'Rutina creada correctamente',
            rutina
        });
    } catch (error) {
        if (conexion && transaccionIniciada) {
            await conexion.query('ROLLBACK').catch(() => {});
        }

        return next(error);
    } finally {
        conexion?.release();
    }
};

export const editarRutina = async (req, res, next) => {
    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.connect();

        const validacionId = obtenerRutinaSchema.safeParse(req.params);
        const validacionDatos = editarRutinaSchema.safeParse(req.body);

        if (!validacionId.success || !validacionDatos.success) {
            return res.status(400).json({
                mensaje: 'Los datos para editar la rutina no son válidos',
                errores: [
                    ...(validacionId.success
                        ? []
                        : validacionId.error.issues),
                    ...(validacionDatos.success
                        ? []
                        : validacionDatos.error.issues)
                ]
            });
        }

        const { id } = validacionId.data;
        const datos = validacionDatos.data;

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        const acceso = await verificarAccesoRutina(
            conexion,
            req,
            id
        );

        if (!acceso) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        const rutinaActual = await obtenerRutinaPorId(
            conexion,
            id,
            true
        );

        if (!rutinaActual) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        if (rutinaActual.estado !== 'ACTIVA') {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: 'Solo se pueden editar rutinas activas'
            });
        }

        const fechaInicio = datos.fecha_inicio ??
            String(rutinaActual.fecha_inicio).slice(0, 10);

        const fechaFin = datos.fecha_fin === undefined
            ? rutinaActual.fecha_fin
            : datos.fecha_fin;

        const fechaFinNormalizada = fechaFin
            ? String(fechaFin).slice(0, 10)
            : null;

        if (
            fechaFinNormalizada &&
            fechaFinNormalizada < fechaInicio
        ) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(400).json({
                mensaje: 'La fecha final no puede ser anterior a la fecha inicial'
            });
        }

        const campos = [];
        const valores = [];

        const agregarCampo = (columna, valor) => {
            valores.push(valor);
            campos.push(`${columna} = $${valores.length}`);
        };

        if (datos.nombre !== undefined) {
            agregarCampo('nombre', datos.nombre);
        }

        if (datos.objetivo !== undefined) {
            agregarCampo('objetivo', datos.objetivo);
        }

        if (datos.descripcion !== undefined) {
            agregarCampo('descripcion', datos.descripcion);
        }

        if (datos.fecha_inicio !== undefined) {
            agregarCampo('fecha_inicio', datos.fecha_inicio);
        }

        if (datos.fecha_fin !== undefined) {
            agregarCampo('fecha_fin', datos.fecha_fin);
        }

        if (campos.length > 0) {
            valores.push(id);

            await conexion.query(
                `UPDATE rutinas
                 SET ${campos.join(', ')},
                     updated_at = NOW()
                 WHERE id = $${valores.length}`,
                valores
            );
        }

        if (datos.ejercicios !== undefined) {
            await conexion.query(
                'DELETE FROM rutina_ejercicios WHERE rutina_id = $1',
                [id]
            );

            for (const ejercicio of datos.ejercicios) {
                await conexion.query(
                    `INSERT INTO rutina_ejercicios (
                        rutina_id,
                        nombre,
                        descripcion,
                        orden,
                        series,
                        repeticiones,
                        descanso_segundos,
                        observaciones
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [
                        id,
                        ejercicio.nombre,
                        ejercicio.descripcion,
                        ejercicio.orden,
                        ejercicio.series,
                        ejercicio.repeticiones,
                        ejercicio.descanso_segundos,
                        ejercicio.observaciones
                    ]
                );
            }
        }

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        const rutina = await obtenerRutinaPorId(pool, id);
        rutina.ejercicios = await obtenerEjercicios(pool, id);

        return res.status(200).json({
            mensaje: 'Rutina actualizada correctamente',
            rutina
        });
    } catch (error) {
        if (conexion && transaccionIniciada) {
            await conexion.query('ROLLBACK').catch(() => {});
        }

        return next(error);
    } finally {
        conexion?.release();
    }
};

export const asignarRutina = async (req, res, next) => {
    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.connect();

        const validacionId = obtenerRutinaSchema.safeParse(req.params);
        const validacionDatos = asignarRutinaSchema.safeParse(req.body);

        if (!validacionId.success || !validacionDatos.success) {
            return res.status(400).json({
                mensaje: 'Los datos para asignar la rutina no son válidos',
                errores: [
                    ...(validacionId.success
                        ? []
                        : validacionId.error.issues),
                    ...(validacionDatos.success
                        ? []
                        : validacionDatos.error.issues)
                ]
            });
        }

        const { id } = validacionId.data;
        const { cliente_id } = validacionDatos.data;

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        const acceso = await verificarAccesoRutina(
            conexion,
            req,
            id
        );

        if (!acceso) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        const rutina = await obtenerRutinaPorId(
            conexion,
            id,
            true
        );

        if (!rutina || rutina.estado !== 'ACTIVA') {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: 'La rutina no existe o no está activa'
            });
        }

        const resultadoCliente = await conexion.query(
            `SELECT id, estado
             FROM clientes
             WHERE id = $1
             FOR UPDATE`,
            [cliente_id]
        );

        if (resultadoCliente.rowCount === 0) {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(404).json({
                mensaje: 'No se encontró el cliente indicado'
            });
        }

        if (resultadoCliente.rows[0].estado !== 'activo') {
            await conexion.query('ROLLBACK');
            transaccionIniciada = false;

            return res.status(409).json({
                mensaje: 'No se puede asignar una rutina a un cliente inactivo'
            });
        }

        await conexion.query(
            `UPDATE rutinas
             SET cliente_id = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [cliente_id, id]
        );

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        return res.status(200).json({
            mensaje: 'Rutina asignada correctamente',
            rutina: await obtenerRutinaPorId(pool, id)
        });
    } catch (error) {
        if (conexion && transaccionIniciada) {
            await conexion.query('ROLLBACK').catch(() => {});
        }

        return next(error);
    } finally {
        conexion?.release();
    }
};

export const cambiarEstadoRutina = async (req, res, next) => {
    try {
        const validacionId = obtenerRutinaSchema.safeParse(req.params);
        const validacionDatos = cambiarEstadoRutinaSchema.safeParse(req.body);

        if (!validacionId.success || !validacionDatos.success) {
            return res.status(400).json({
                mensaje: 'Los datos para cambiar el estado no son válidos'
            });
        }

        const { id } = validacionId.data;
        const { estado } = validacionDatos.data;

        const acceso = await verificarAccesoRutina(
            pool,
            req,
            id
        );

        if (!acceso) {
            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        const resultado = await pool.query(
            `UPDATE rutinas
             SET estado = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING *`,
            [estado, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        return res.status(200).json({
            mensaje: 'Estado de la rutina actualizado correctamente',
            rutina: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const eliminarRutina = async (req, res, next) => {
    try {
        const validacion = obtenerRutinaSchema.safeParse(req.params);

        if (!validacion.success) {
            return res.status(400).json({
                mensaje: 'El identificador de la rutina no es válido'
            });
        }

        const { id } = validacion.data;

        const acceso = await verificarAccesoRutina(
            pool,
            req,
            id
        );

        if (!acceso) {
            return res.status(404).json({
                mensaje: 'No se encontró la rutina indicada'
            });
        }

        const resultado = await pool.query(
            `UPDATE rutinas
             SET estado = 'INACTIVA',
                 updated_at = NOW()
             WHERE id = $1
               AND estado <> 'INACTIVA'
             RETURNING id`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                mensaje: 'No se encontró una rutina activa para desactivar'
            });
        }

        return res.status(200).json({
            mensaje: 'Rutina desactivada correctamente'
        });
    } catch (error) {
        return next(error);
    }
};