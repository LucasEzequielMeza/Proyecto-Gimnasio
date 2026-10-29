import { pool } from '../../db.js';

import {
    listarClasesSchema,
    crearClaseSchema,
    actualizarClaseSchema,
    crearSesionSchema,
    listarSesionesSchema,
    actualizarSesionSchema,
    crearReservaSchema,
    listarReservasSchema,
    obtenerReservaSchema,
    actualizarAsistenciaSchema
} from './clases.schemas.js';

const tieneRol = (req, rol) =>
    req.usuario?.roles?.includes(rol) ?? false;

const esPersonalAutorizado = (req) =>
    tieneRol(req, 'ADMIN') || tieneRol(req, 'RECEPCION');

const esEntrenadorExclusivo = (req) =>
    tieneRol(req, 'ENTRENADOR') && !esPersonalAutorizado(req);

const responderValidacion = (res, validacion, mensaje) => {
    if (validacion.success) return false;

    res.status(400).json({
        mensaje,
        errores: validacion.error.issues
    });

    return true;
};

const responderError = (res, estado, mensaje) =>
    res.status(estado).json({ mensaje });

const obtenerClientePropio = async (conexion, usuarioId) => {
    const resultado = await conexion.query(
        `SELECT id, usuario_id
         FROM clientes
         WHERE usuario_id = $1
           AND estado = 'activo'
         LIMIT 1`,
        [usuarioId]
    );

    return resultado.rows[0] ?? null;
};

const obtenerEntrenadorActivo = async (conexion, entrenadorId) => {
    const resultado = await conexion.query(
        `SELECT u.id
         FROM usuarios u
         WHERE u.id = $1
           AND u.estado = 'activo'
           AND EXISTS (
               SELECT 1
               FROM usuario_roles ur
               INNER JOIN roles r ON r.id = ur.rol_id
               WHERE ur.usuario_id = u.id
                 AND r.nombre = 'ENTRENADOR'
           )
         LIMIT 1`,
        [entrenadorId]
    );

    return resultado.rows[0] ?? null;
};

const obtenerOcupacion = async (conexion, sesionId) => {
    const resultado = await conexion.query(
        `SELECT COUNT(*)::INTEGER AS total
         FROM reservas_clase
         WHERE sesion_id = $1
           AND estado IN ('RESERVADA', 'ASISTIO', 'AUSENTE')`,
        [sesionId]
    );

    return resultado.rows[0].total;
};

const obtenerMembresiaVigente = async (conexion, clienteId) => {
    const resultado = await conexion.query(
        `SELECT id
         FROM membresias
         WHERE cliente_id = $1
           AND estado IN ('ACTIVA', 'CANCELADA')
           AND fecha_inicio <= (
               NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
           )::DATE
           AND fecha_fin >= (
               NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
           )::DATE
         LIMIT 1`,
        [clienteId]
    );

    return resultado.rowCount > 0;
};

const existeSolapamientoEntrenador = async (
    conexion,
    { entrenadorId, fechaInicio, fechaFin, excluirSesionId = null }
) => {
    /* Serializo la programación por entrenador para evitar cruces entre solicitudes simultáneas. */
    await conexion.query(
        'SELECT pg_advisory_xact_lock(hashtext($1::text))',
        [`proyectogym:entrenador:${entrenadorId}`]
    );

    const resultado = await conexion.query(
        `SELECT id
         FROM sesiones_clase
         WHERE entrenador_id = $1
           AND estado = 'PROGRAMADA'
           AND fecha_inicio < $3
           AND fecha_fin > $2
           AND ($4::uuid IS NULL OR id <> $4)
         LIMIT 1`,
        [entrenadorId, fechaInicio, fechaFin, excluirSesionId]
    );

    return resultado.rowCount > 0;
};

const crearNotificacionReserva = async (
    conexion,
    { usuarioId, titulo, mensaje, entidadId, claveUnica }
) => {
    if (!usuarioId) return;

    await conexion.query(
        `INSERT INTO notificaciones (
            usuario_id,
            tipo,
            titulo,
            mensaje,
            entidad_tipo,
            entidad_id,
            clave_unica
         )
         VALUES ($1, 'RESERVA', $2, $3, 'reserva_clase', $4, $5)
         ON CONFLICT (clave_unica) DO NOTHING`,
        [usuarioId, titulo, mensaje, entidadId, claveUnica]
    );
};

/* Muestro a los clientes únicamente las clases activas, aunque envíen filtros distintos. */
export const listarClases = async (req, res, next) => {
    try {
        const validacion = listarClasesSchema.safeParse(req.query);

        if (responderValidacion(
            res,
            validacion,
            'Los filtros de clases no son válidos'
        )) return;

        const { estado, pagina, limite } = validacion.data;
        const condiciones = [];
        const valores = [];

        if (tieneRol(req, 'CLIENTE')) {
            condiciones.push(`estado = 'ACTIVA'`);
        } else if (estado) {
            valores.push(estado);
            condiciones.push(`estado = $${valores.length}`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const totalResultado = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM clases
             ${where}`,
            valores
        );

        const total = totalResultado.rows[0].total;
        const offset = (pagina - 1) * limite;
        const valoresPaginacion = [...valores, limite, offset];

        const resultado = await pool.query(
            `SELECT
                id, nombre, descripcion, duracion_minutos, estado,
                created_at, updated_at
             FROM clases
             ${where}
             ORDER BY nombre ASC
             LIMIT $${valoresPaginacion.length - 1}
             OFFSET $${valoresPaginacion.length}`,
            valoresPaginacion
        );

        return res.status(200).json({
            clases: resultado.rows,
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

export const crearClase = async (req, res, next) => {
    try {
        if (!tieneRol(req, 'ADMIN')) {
            return responderError(res, 403, 'Solo un administrador puede crear clases');
        }

        const validacion = crearClaseSchema.safeParse(req.body);

        if (responderValidacion(res, validacion, 'Los datos de la clase no son válidos')) return;

        const { nombre, descripcion, duracion_minutos } = validacion.data;

        const resultado = await pool.query(
            `INSERT INTO clases (nombre, descripcion, duracion_minutos)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [nombre, descripcion ?? null, duracion_minutos]
        );

        return res.status(201).json({
            mensaje: 'Clase creada correctamente',
            clase: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const actualizarClase = async (req, res, next) => {
    try {
        if (!tieneRol(req, 'ADMIN')) {
            return responderError(res, 403, 'Solo un administrador puede modificar clases');
        }

        const validacion = actualizarClaseSchema.safeParse({
            ...req.body,
            id: req.params.id
        });

        if (responderValidacion(res, validacion, 'Los datos de actualización no son válidos')) return;

        const { id, ...datos } = validacion.data;
        const camposPermitidos = {
            nombre: 'nombre',
            descripcion: 'descripcion',
            duracion_minutos: 'duracion_minutos',
            estado: 'estado'
        };
        const asignaciones = [];
        const valores = [];

        for (const [campo, columna] of Object.entries(camposPermitidos)) {
            if (datos[campo] !== undefined) {
                valores.push(datos[campo]);
                asignaciones.push(`${columna} = $${valores.length}`);
            }
        }

        asignaciones.push('updated_at = NOW()');
        valores.push(id);

        const resultado = await pool.query(
            `UPDATE clases
             SET ${asignaciones.join(', ')}
             WHERE id = $${valores.length}
             RETURNING *`,
            valores
        );

        if (resultado.rowCount === 0) {
            return responderError(res, 404, 'No se encontró la clase');
        }

        return res.status(200).json({
            mensaje: 'Clase actualizada correctamente',
            clase: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};

export const listarSesiones = async (req, res, next) => {
    try {
        const validacion = listarSesionesSchema.safeParse(req.query);

        if (responderValidacion(res, validacion, 'Los filtros de sesiones no son válidos')) return;

        const {
            clase_id, entrenador_id, desde, hasta, estado, pagina, limite
        } = validacion.data;

        const condiciones = [];
        const valores = [];

        if (clase_id) {
            valores.push(clase_id);
            condiciones.push(`s.clase_id = $${valores.length}`);
        }

        if (entrenador_id) {
            valores.push(entrenador_id);
            condiciones.push(`s.entrenador_id = $${valores.length}`);
        }

        if (desde) {
            valores.push(desde);
            condiciones.push(`s.fecha_inicio >= $${valores.length}`);
        }

        if (hasta) {
            valores.push(hasta);
            condiciones.push(`s.fecha_inicio <= $${valores.length}`);
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(`s.estado = $${valores.length}`);
        }

        if (tieneRol(req, 'CLIENTE')) {
            condiciones.push(`c.estado = 'ACTIVA'`);
            condiciones.push(`s.estado = 'PROGRAMADA'`);
            condiciones.push(`s.fecha_inicio > NOW()`);
        }

        if (esEntrenadorExclusivo(req)) {
            valores.push(req.usuario.id);
            condiciones.push(`s.entrenador_id = $${valores.length}`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const totalResultado = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM sesiones_clase s
             INNER JOIN clases c ON c.id = s.clase_id
             ${where}`,
            valores
        );

        const total = totalResultado.rows[0].total;
        const offset = (pagina - 1) * limite;
        const valoresPaginacion = [...valores, limite, offset];

        const resultado = await pool.query(
            `SELECT
                s.id, s.clase_id, c.nombre AS clase_nombre,
                c.duracion_minutos, s.entrenador_id,
                u.nombre AS entrenador_nombre,
                u.apellido AS entrenador_apellido,
                s.fecha_inicio, s.fecha_fin, s.cupo, s.estado,
                (
                    SELECT COUNT(*)::INTEGER
                    FROM reservas_clase r
                    WHERE r.sesion_id = s.id
                      AND r.estado IN ('RESERVADA', 'ASISTIO', 'AUSENTE')
                ) AS lugares_ocupados,
                GREATEST(
                    s.cupo - (
                        SELECT COUNT(*)::INTEGER
                        FROM reservas_clase r
                        WHERE r.sesion_id = s.id
                          AND r.estado IN ('RESERVADA', 'ASISTIO', 'AUSENTE')
                    ),
                    0
                ) AS lugares_disponibles
             FROM sesiones_clase s
             INNER JOIN clases c ON c.id = s.clase_id
             INNER JOIN usuarios u ON u.id = s.entrenador_id
             ${where}
             ORDER BY s.fecha_inicio ASC
             LIMIT $${valoresPaginacion.length - 1}
             OFFSET $${valoresPaginacion.length}`,
            valoresPaginacion
        );

        return res.status(200).json({
            sesiones: resultado.rows,
            paginacion: {
                pagina, limite, total,
                totalPaginas: Math.ceil(total / limite)
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const crearSesion = async (req, res, next) => {
    try {
        if (!tieneRol(req, 'ADMIN') && !tieneRol(req, 'ENTRENADOR')) {
            return responderError(res, 403, 'No tenés permiso para programar sesiones');
        }

        const validacion = crearSesionSchema.safeParse(req.body);

        if (responderValidacion(res, validacion, 'Los datos de la sesión no son válidos')) return;

        const { clase_id, entrenador_id, fecha_inicio, fecha_fin, cupo } = validacion.data;
        const entrenadorAsignado = esEntrenadorExclusivo(req)
            ? req.usuario.id
            : entrenador_id;

        if (esEntrenadorExclusivo(req) && entrenador_id !== req.usuario.id) {
            return responderError(res, 403, 'Solo podés programar sesiones a tu nombre');
        }

        const conexion = await pool.connect();

        try {
            await conexion.query('BEGIN');

            const clase = await conexion.query(
                `SELECT id FROM clases
                 WHERE id = $1 AND estado = 'ACTIVA'
                 FOR UPDATE`,
                [clase_id]
            );

            if (clase.rowCount === 0) {
                await conexion.query('ROLLBACK');
                return responderError(res, 404, 'No se encontró una clase activa');
            }

            const entrenador = await obtenerEntrenadorActivo(conexion, entrenadorAsignado);

            if (!entrenador) {
                await conexion.query('ROLLBACK');
                return responderError(res, 400, 'El entrenador no existe o no está activo');
            }

            const haySolapamiento = await existeSolapamientoEntrenador(conexion, {
                entrenadorId: entrenadorAsignado,
                fechaInicio: fecha_inicio,
                fechaFin: fecha_fin
            });

            if (haySolapamiento) {
                await conexion.query('ROLLBACK');
                return responderError(res, 409, 'El entrenador ya tiene una sesión programada en ese horario');
            }

            const sesion = await conexion.query(
                `INSERT INTO sesiones_clase (
                    clase_id, entrenador_id, fecha_inicio, fecha_fin, cupo
                 )
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING *`,
                [clase_id, entrenadorAsignado, fecha_inicio, fecha_fin, cupo]
            );

            await conexion.query('COMMIT');

            return res.status(201).json({
                mensaje: 'Sesión programada correctamente',
                sesion: sesion.rows[0]
            });
        } catch (error) {
            await conexion.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            conexion.release();
        }
    } catch (error) {
        return next(error);
    }
};

export const actualizarSesion = async (req, res, next) => {
    let conexion;

    try {
        if (!tieneRol(req, 'ADMIN') && !tieneRol(req, 'ENTRENADOR')) {
            return responderError(res, 403, 'No tenés permiso para modificar sesiones');
        }

        const validacion = actualizarSesionSchema.safeParse({
            ...req.body,
            id: req.params.id
        });

        if (responderValidacion(res, validacion, 'Los datos de actualización de la sesión no son válidos')) return;

        const { id, ...datos } = validacion.data;
        conexion = await pool.connect();
        await conexion.query('BEGIN');

        const actual = await conexion.query(
            `SELECT * FROM sesiones_clase WHERE id = $1 FOR UPDATE`,
            [id]
        );

        if (actual.rowCount === 0) {
            await conexion.query('ROLLBACK');
            return responderError(res, 404, 'No se encontró la sesión');
        }

        const sesionActual = actual.rows[0];

        if (['CANCELADA', 'FINALIZADA'].includes(sesionActual.estado)) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'No se pueden modificar sesiones canceladas o finalizadas');
        }

        if (esEntrenadorExclusivo(req) && sesionActual.entrenador_id !== req.usuario.id) {
            await conexion.query('ROLLBACK');
            return responderError(res, 403, 'Solo podés modificar tus propias sesiones');
        }

        if (esEntrenadorExclusivo(req) && datos.entrenador_id && datos.entrenador_id !== req.usuario.id) {
            await conexion.query('ROLLBACK');
            return responderError(res, 403, 'No podés reasignar una sesión a otro entrenador');
        }

        const fechaInicio = datos.fecha_inicio
            ? new Date(datos.fecha_inicio)
            : new Date(sesionActual.fecha_inicio);
        const fechaFin = datos.fecha_fin
            ? new Date(datos.fecha_fin)
            : new Date(sesionActual.fecha_fin);

        if (fechaFin <= fechaInicio) {
            await conexion.query('ROLLBACK');
            return responderError(res, 400, 'La fecha de finalización debe ser posterior al inicio');
        }

        const ahora = new Date();

        if (
            (datos.fecha_inicio !== undefined || datos.fecha_fin !== undefined)
            && fechaInicio <= ahora
        ) {
            await conexion.query('ROLLBACK');
            return responderError(res, 400, 'El nuevo horario debe tener una fecha de inicio futura');
        }

        if (datos.estado === 'FINALIZADA' && fechaFin > ahora) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'No se puede finalizar una sesión que todavía no terminó');
        }

        if (datos.estado === 'CANCELADA' && new Date(sesionActual.fecha_inicio) <= ahora) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'No se puede cancelar una sesión que ya comenzó');
        }

        if (datos.estado === 'CANCELADA') {
            const reservas = await conexion.query(
                `SELECT r.id, cl.usuario_id
                 FROM reservas_clase r
                 INNER JOIN clientes cl ON cl.id = r.cliente_id
                 WHERE r.sesion_id = $1 AND r.estado = 'RESERVADA'
                 FOR UPDATE OF r`,
                [id]
            );

            await conexion.query(
                `UPDATE reservas_clase
                 SET estado = 'CANCELADA',
                     cancelada_at = NOW(),
                     updated_at = NOW()
                 WHERE sesion_id = $1 AND estado = 'RESERVADA'`,
                [id]
            );

            for (const reserva of reservas.rows) {
                await crearNotificacionReserva(conexion, {
                    usuarioId: reserva.usuario_id,
                    titulo: 'Sesión cancelada',
                    mensaje: 'La sesión reservada fue cancelada. Podés consultar otras sesiones disponibles.',
                    entidadId: id,
                    claveUnica: `sesion:${id}:cancelacion:reserva:${reserva.id}`
                });
            }
        }

        const cupoNuevo = datos.cupo ?? sesionActual.cupo;

        if (datos.cupo !== undefined) {
            const ocupacion = await obtenerOcupacion(conexion, id);

            if (cupoNuevo < ocupacion) {
                await conexion.query('ROLLBACK');
                return responderError(res, 409, 'El cupo no puede ser menor que las reservas existentes');
            }
        }

        if (datos.entrenador_id) {
            const entrenador = await obtenerEntrenadorActivo(conexion, datos.entrenador_id);

            if (!entrenador) {
                await conexion.query('ROLLBACK');
                return responderError(res, 400, 'El entrenador no existe o no está activo');
            }
        }

        /* Impido cambios estructurales cuando la sesión ya comenzó, pero permito finalizarla al terminar. */
        if (
            new Date(sesionActual.fecha_inicio) <= new Date()
            && (
                datos.fecha_inicio !== undefined
                || datos.fecha_fin !== undefined
                || datos.entrenador_id !== undefined
                || datos.cupo !== undefined
            )
        ) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'No se pueden modificar horario, entrenador o cupo después de comenzar la sesión');
        }

        const entrenadorFinal = datos.entrenador_id ?? sesionActual.entrenador_id;
        const estadoFinal = datos.estado ?? sesionActual.estado;

        if (estadoFinal === 'PROGRAMADA') {
            const haySolapamiento = await existeSolapamientoEntrenador(conexion, {
                entrenadorId: entrenadorFinal,
                fechaInicio: datos.fecha_inicio ?? sesionActual.fecha_inicio,
                fechaFin: datos.fecha_fin ?? sesionActual.fecha_fin,
                excluirSesionId: id
            });

            if (haySolapamiento) {
                await conexion.query('ROLLBACK');
                return responderError(res, 409, 'El entrenador ya tiene una sesión programada en ese horario');
            }
        }

        const camposPermitidos = {
            entrenador_id: 'entrenador_id',
            fecha_inicio: 'fecha_inicio',
            fecha_fin: 'fecha_fin',
            cupo: 'cupo',
            estado: 'estado'
        };
        const asignaciones = [];
        const valores = [];

        for (const [campo, columna] of Object.entries(camposPermitidos)) {
            if (datos[campo] !== undefined) {
                valores.push(datos[campo]);
                asignaciones.push(`${columna} = $${valores.length}`);
            }
        }

        if (asignaciones.length === 0) {
            await conexion.query('ROLLBACK');
            return responderError(res, 400, 'No hay cambios para guardar');
        }

        asignaciones.push('updated_at = NOW()');
        valores.push(id);

        const resultado = await conexion.query(
            `UPDATE sesiones_clase
             SET ${asignaciones.join(', ')}
             WHERE id = $${valores.length}
             RETURNING *`,
            valores
        );

        await conexion.query('COMMIT');

        return res.status(200).json({
            mensaje: 'Sesión actualizada correctamente',
            sesion: resultado.rows[0]
        });
    } catch (error) {
        if (conexion) await conexion.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        conexion?.release();
    }
};

export const listarReservas = async (req, res, next) => {
    try {
        const validacion = listarReservasSchema.safeParse(req.query);

        if (responderValidacion(res, validacion, 'Los filtros de reservas no son válidos')) return;

        const { sesion_id, cliente_id, estado, pagina, limite } = validacion.data;
        const condiciones = [];
        const valores = [];

        if (sesion_id) {
            valores.push(sesion_id);
            condiciones.push(`r.sesion_id = $${valores.length}`);
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(`r.estado = $${valores.length}`);
        }

        if (tieneRol(req, 'CLIENTE') && !esPersonalAutorizado(req)) {
            valores.push(req.usuario.id);
            condiciones.push(
                `EXISTS (
                    SELECT 1 FROM clientes cp
                    WHERE cp.id = r.cliente_id AND cp.usuario_id = $${valores.length}
                )`
            );
        } else if (esEntrenadorExclusivo(req)) {
            valores.push(req.usuario.id);
            condiciones.push(`s.entrenador_id = $${valores.length}`);

            if (cliente_id) {
                valores.push(cliente_id);
                condiciones.push(`r.cliente_id = $${valores.length}`);
            }
        } else if (cliente_id) {
            valores.push(cliente_id);
            condiciones.push(`r.cliente_id = $${valores.length}`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

        const totalResultado = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM reservas_clase r
             INNER JOIN sesiones_clase s ON s.id = r.sesion_id
             ${where}`,
            valores
        );

        const total = totalResultado.rows[0].total;
        const offset = (pagina - 1) * limite;
        const valoresPaginacion = [...valores, limite, offset];

        const resultado = await pool.query(
            `SELECT
                r.id, r.sesion_id, r.cliente_id,
                cl.nombre AS cliente_nombre, cl.apellido AS cliente_apellido,
                c.nombre AS clase_nombre, s.fecha_inicio, s.fecha_fin,
                s.entrenador_id, r.estado, r.fecha_reserva, r.cancelada_at,
                r.created_at, r.updated_at
             FROM reservas_clase r
             INNER JOIN clientes cl ON cl.id = r.cliente_id
             INNER JOIN sesiones_clase s ON s.id = r.sesion_id
             INNER JOIN clases c ON c.id = s.clase_id
             ${where}
             ORDER BY s.fecha_inicio DESC, r.created_at DESC
             LIMIT $${valoresPaginacion.length - 1}
             OFFSET $${valoresPaginacion.length}`,
            valoresPaginacion
        );

        return res.status(200).json({
            reservas: resultado.rows,
            paginacion: {
                pagina, limite, total,
                totalPaginas: Math.ceil(total / limite)
            }
        });
    } catch (error) {
        return next(error);
    }
};

export const crearReserva = async (req, res, next) => {
    let conexion;

    try {
        const validacion = crearReservaSchema.safeParse(req.body);

        if (responderValidacion(res, validacion, 'Los datos de la reserva no son válidos')) return;

        conexion = await pool.connect();

        const { sesion_id, cliente_id: clienteSolicitado } = validacion.data;
        const puedeReservarParaOtros = esPersonalAutorizado(req);
        let clienteId;

        /* Fuerzo al cliente a reservar para sí mismo, aunque tenga más de un rol. */
        if (tieneRol(req, 'CLIENTE') && !puedeReservarParaOtros) {
            const cliente = await obtenerClientePropio(conexion, req.usuario.id);

            if (!cliente) {
                return responderError(res, 403, 'Tu cuenta no está vinculada a un cliente activo');
            }

            clienteId = cliente.id;
        } else {
            clienteId = clienteSolicitado;

            if (!clienteId) {
                return responderError(res, 400, 'Debés indicar el cliente para la reserva');
            }
        }

        await conexion.query('BEGIN');

        const sesionResultado = await conexion.query(
            `SELECT
                s.id, s.fecha_inicio, s.fecha_fin, s.cupo, s.estado,
                c.estado AS clase_estado
             FROM sesiones_clase s
             INNER JOIN clases c ON c.id = s.clase_id
             WHERE s.id = $1
             FOR UPDATE OF s`,
            [sesion_id]
        );

        if (sesionResultado.rowCount === 0) {
            await conexion.query('ROLLBACK');
            return responderError(res, 404, 'No se encontró la sesión');
        }

        const sesion = sesionResultado.rows[0];

        if (sesion.estado !== 'PROGRAMADA' || sesion.clase_estado !== 'ACTIVA' || new Date(sesion.fecha_inicio) <= new Date()) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'La sesión no admite nuevas reservas');
        }

        const clienteResultado = await conexion.query(
            `SELECT id, usuario_id
             FROM clientes
             WHERE id = $1 AND estado = 'activo'
             FOR UPDATE`,
            [clienteId]
        );

        if (clienteResultado.rowCount === 0) {
            await conexion.query('ROLLBACK');
            return responderError(res, 404, 'No se encontró un cliente activo');
        }

        /* Exijo membresía vigente tanto en reservas propias como administrativas. */
        const tieneMembresia = await obtenerMembresiaVigente(conexion, clienteId);

        if (!tieneMembresia) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'El cliente necesita una membresía vigente para reservar una clase');
        }

        const reservaExistente = await conexion.query(
            `SELECT id
             FROM reservas_clase
             WHERE sesion_id = $1
               AND cliente_id = $2
               AND estado IN ('RESERVADA', 'ASISTIO', 'AUSENTE')
             LIMIT 1`,
            [sesion_id, clienteId]
        );

        if (reservaExistente.rowCount > 0) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'El cliente ya tiene una reserva para esta sesión');
        }

        const ocupacion = await obtenerOcupacion(conexion, sesion_id);

        if (ocupacion >= sesion.cupo) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'La sesión ya alcanzó su cupo máximo');
        }

        const reserva = await conexion.query(
            `INSERT INTO reservas_clase (sesion_id, cliente_id)
             VALUES ($1, $2)
             RETURNING *`,
            [sesion_id, clienteId]
        );

        await crearNotificacionReserva(conexion, {
            usuarioId: clienteResultado.rows[0].usuario_id,
            titulo: 'Reserva confirmada',
            mensaje: 'Tu lugar en la clase quedó reservado correctamente.',
            entidadId: reserva.rows[0].id,
            claveUnica: `reserva:${reserva.rows[0].id}:confirmada`
        });

        await conexion.query('COMMIT');

        return res.status(201).json({
            mensaje: 'Reserva creada correctamente',
            reserva: reserva.rows[0]
        });
    } catch (error) {
        if (conexion) await conexion.query('ROLLBACK').catch(() => {});

        if (error.code === '23505') {
            return responderError(res, 409, 'El cliente ya tiene una reserva para esta sesión');
        }

        return next(error);
    } finally {
        conexion?.release();
    }
};

export const cancelarReserva = async (req, res, next) => {
    let conexion;

    try {
        const validacion = obtenerReservaSchema.safeParse(req.params);

        if (responderValidacion(res, validacion, 'El identificador de la reserva no es válido')) return;

        conexion = await pool.connect();
        await conexion.query('BEGIN');

        const resultado = await conexion.query(
            `SELECT
                r.id, r.cliente_id, r.estado, r.sesion_id,
                s.fecha_inicio, cl.usuario_id
             FROM reservas_clase r
             INNER JOIN sesiones_clase s ON s.id = r.sesion_id
             INNER JOIN clientes cl ON cl.id = r.cliente_id
             WHERE r.id = $1
             FOR UPDATE OF r`,
            [validacion.data.id]
        );

        if (resultado.rowCount === 0) {
            await conexion.query('ROLLBACK');
            return responderError(res, 404, 'No se encontró la reserva');
        }

        const reserva = resultado.rows[0];
        const esPropietario = tieneRol(req, 'CLIENTE') && reserva.usuario_id === req.usuario.id;

        if (!esPersonalAutorizado(req) && !esPropietario) {
            await conexion.query('ROLLBACK');
            return responderError(res, 403, 'No tenés permiso para cancelar esta reserva');
        }

        if (reserva.estado !== 'RESERVADA') {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'Solo se pueden cancelar reservas activas');
        }

        if (new Date(reserva.fecha_inicio) <= new Date()) {
            await conexion.query('ROLLBACK');
            return responderError(res, 409, 'No se puede cancelar una reserva cuya sesión ya comenzó');
        }

        const actualizada = await conexion.query(
            `UPDATE reservas_clase
             SET estado = 'CANCELADA', cancelada_at = NOW(), updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [reserva.id]
        );

        await conexion.query('COMMIT');

        return res.status(200).json({
            mensaje: 'Reserva cancelada correctamente',
            reserva: actualizada.rows[0]
        });
    } catch (error) {
        if (conexion) await conexion.query('ROLLBACK').catch(() => {});
        return next(error);
    } finally {
        conexion?.release();
    }
};

export const actualizarAsistencia = async (req, res, next) => {
    try {
        if (!tieneRol(req, 'ADMIN') && !tieneRol(req, 'RECEPCION') && !tieneRol(req, 'ENTRENADOR')) {
            return responderError(res, 403, 'No tenés permiso para registrar asistencia');
        }

        const validacion = actualizarAsistenciaSchema.safeParse({
            ...req.body,
            id: req.params.id
        });

        if (responderValidacion(res, validacion, 'Los datos de asistencia no son válidos')) return;

        const { id, estado } = validacion.data;
        const valores = [estado, id];
        let condicionEntrenador = '';

        if (esEntrenadorExclusivo(req)) {
            valores.push(req.usuario.id);
            condicionEntrenador = `AND s.entrenador_id = $${valores.length}`;
        }

        const resultado = await pool.query(
            `UPDATE reservas_clase r
             SET estado = $1, updated_at = NOW()
             FROM sesiones_clase s
             WHERE r.sesion_id = s.id
               AND r.id = $2
               ${condicionEntrenador}
               AND r.estado IN ('RESERVADA', 'ASISTIO', 'AUSENTE')
               AND s.estado IN ('PROGRAMADA', 'FINALIZADA')
               AND s.fecha_fin <= NOW()
             RETURNING r.*`,
            valores
        );

        if (resultado.rowCount === 0) {
            return responderError(res, 404, 'No se encontró una reserva válida para esa sesión');
        }

        return res.status(200).json({
            mensaje: 'Asistencia actualizada correctamente',
            reserva: resultado.rows[0]
        });
    } catch (error) {
        return next(error);
    }
};