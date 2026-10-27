import { pool } from '../../db.js';

import {
    listarMembresiasSchema,
    idMembresiaSchema,
    crearMembresiaSchema,
    editarMembresiaSchema,
    cambiarEstadoMembresiaSchema,
} from './membresias.schemas.js';

import {
    actualizarMembresiasVencidas,
} from './membresias.vencimientos.js';

const responderErrorValidacion = (res, error) => {
    return res.status(400).json({
        success: false,
        message: 'Los datos enviados no son válidos',
        errores: error.issues.map((issue) => ({
            campo: issue.path.join('.'),
            mensaje: issue.message,
        })),
    });
};

const responderError = (res, status, message) => {
    return res.status(status).json({
        success: false,
        message,
    });
};

const obtenerFechaActual = async (cliente = pool) => {
    const resultado = await cliente.query(`
        SELECT (
            NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
        )::date::text AS hoy
    `);

    return resultado.rows[0].hoy;
};

const fechaUTC = (fecha) => {
    const [anio, mes, dia] = fecha.split('-').map(Number);

    return new Date(Date.UTC(anio, mes - 1, dia));
};

const formatoFechaUTC = (fecha) => {
    return fecha.toISOString().slice(0, 10);
};

const sumarDias = (fecha, dias) => {
    const resultado = fechaUTC(fecha);

    resultado.setUTCDate(resultado.getUTCDate() + dias);

    return formatoFechaUTC(resultado);
};

const sumarMesesCalendario = (fecha, cantidad) => {
    const original = fechaUTC(fecha);
    const diaOriginal = original.getUTCDate();

    const primerDiaDestino = new Date(Date.UTC(
        original.getUTCFullYear(),
        original.getUTCMonth() + cantidad,
        1
    ));

    const ultimoDiaDestino = new Date(Date.UTC(
        primerDiaDestino.getUTCFullYear(),
        primerDiaDestino.getUTCMonth() + 1,
        0
    )).getUTCDate();

    primerDiaDestino.setUTCDate(
        Math.min(diaOriginal, ultimoDiaDestino)
    );

    return formatoFechaUTC(primerDiaDestino);
};

const calcularFechaFin = (fechaInicio, tipoPlan, duracionDias) => {
    if (tipoPlan === 'FIJO') {
        return sumarDias(fechaInicio, duracionDias - 1);
    }

    const siguientePeriodo = sumarMesesCalendario(fechaInicio, 1);

    return sumarDias(siguientePeriodo, -1);
};

const validarId = (req, res) => {
    const resultado = idMembresiaSchema.safeParse(req.params);

    if (!resultado.success) {
        responderErrorValidacion(res, resultado.error);
        return null;
    }

    return resultado.data.id;
};

const revertirTransaccion = async (cliente, transaccionIniciada) => {
    if (!cliente || !transaccionIniciada) {
        return;
    }

    try {
        await cliente.query('ROLLBACK');
    } catch (error) {
        console.error(
            'Error al revertir la transacción:',
            error.message
        );
    }
};

// GET /api/membresias
export const listarMembresias = async (req, res) => {
    const validacion = listarMembresiasSchema.safeParse(req.query);

    if (!validacion.success) {
        return responderErrorValidacion(res, validacion.error);
    }

    const {
        pagina,
        limite,
        cliente_id,
        plan_id,
        estado,
        busqueda,
    } = validacion.data;

    const condiciones = [];
    const valores = [];

    const agregarCondicion = (sql, valor) => {
        valores.push(valor);
        condiciones.push(sql.replace('?', `$${valores.length}`));
    };

    if (cliente_id) {
        agregarCondicion('m.cliente_id = ?', cliente_id);
    }

    if (plan_id) {
        agregarCondicion('m.plan_id = ?', plan_id);
    }

    if (estado) {
        agregarCondicion('m.estado = ?', estado);
    }

    if (busqueda) {
        valores.push(`%${busqueda}%`);
        const parametro = `$${valores.length}`;

        condiciones.push(`(
            c.nombre ILIKE ${parametro}
            OR c.apellido ILIKE ${parametro}
            OR p.nombre ILIKE ${parametro}
            OR CONCAT(c.nombre, ' ', c.apellido) ILIKE ${parametro}
        )`);
    }

    const where = condiciones.length
        ? `WHERE ${condiciones.join(' AND ')}`
        : '';

    const offset = (pagina - 1) * limite;

    try {
        // Persiste los vencimientos antes de filtrar por estado.
        await actualizarMembresiasVencidas();

        const consulta = `
            SELECT
                m.id,
                m.cliente_id,
                m.plan_id,
                m.fecha_inicio,
                m.fecha_fin,
                m.precio,
                m.moneda,
                m.tipo_plan,
                m.duracion_dias,
                m.estado,
                m.created_at,
                m.updated_at,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                p.nombre AS plan_nombre
            FROM membresias m
            INNER JOIN clientes c ON c.id = m.cliente_id
            INNER JOIN planes p ON p.id = m.plan_id
            ${where}
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT $${valores.length + 1}
            OFFSET $${valores.length + 2}
        `;

        const consultaTotal = `
            SELECT COUNT(*)::INTEGER AS total
            FROM membresias m
            INNER JOIN clientes c ON c.id = m.cliente_id
            INNER JOIN planes p ON p.id = m.plan_id
            ${where}
        `;

        const [resultado, resultadoTotal] = await Promise.all([
            pool.query(consulta, [...valores, limite, offset]),
            pool.query(consultaTotal, valores),
        ]);

        const total = resultadoTotal.rows[0].total;

        return res.status(200).json({
            success: true,
            message: 'Membresías obtenidas correctamente',
            data: resultado.rows,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite),
            },
        });
    } catch (error) {
        console.error('Error al listar membresías:', error);

        return responderError(
            res,
            500,
            'Ocurrió un error al obtener las membresías'
        );
    }
};

// GET /api/membresias/:id
export const obtenerMembresia = async (req, res) => {
    const id = validarId(req, res);

    if (!id) return;

    try {
        await actualizarMembresiasVencidas();

        const resultado = await pool.query(
            `SELECT
                m.id,
                m.cliente_id,
                m.plan_id,
                m.fecha_inicio,
                m.fecha_fin,
                m.precio,
                m.moneda,
                m.tipo_plan,
                m.duracion_dias,
                m.estado,
                m.created_at,
                m.updated_at,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                p.nombre AS plan_nombre
             FROM membresias m
             INNER JOIN clientes c ON c.id = m.cliente_id
             INNER JOIN planes p ON p.id = m.plan_id
             WHERE m.id = $1`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return responderError(
                res,
                404,
                'La membresía solicitada no existe'
            );
        }

        return res.status(200).json({
            success: true,
            message: 'Membresía obtenida correctamente',
            data: resultado.rows[0],
        });
    } catch (error) {
        console.error('Error al obtener membresía:', error);

        return responderError(
            res,
            500,
            'Ocurrió un error al obtener la membresía'
        );
    }
};

// POST /api/membresias
export const crearMembresia = async (req, res) => {
    const validacion = crearMembresiaSchema.safeParse(req.body);

    if (!validacion.success) {
        return responderErrorValidacion(res, validacion.error);
    }

    const {
        cliente_id,
        plan_id,
        fecha_inicio,
    } = validacion.data;

    let client;
    let transaccionIniciada = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transaccionIniciada = true;

        const hoy = await obtenerFechaActual(client);
        const inicio = fecha_inicio ?? hoy;

        if (inicio > hoy) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                400,
                'La fecha de inicio no puede ser futura'
            );
        }

        // Serializa las contrataciones del mismo cliente.
        const cliente = await client.query(
            `SELECT id, estado
             FROM clientes
             WHERE id = $1
             FOR UPDATE`,
            [cliente_id]
        );

        if (cliente.rowCount === 0) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(res, 404, 'El cliente no existe');
        }

        if (cliente.rows[0].estado !== 'activo') {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'No se puede crear una membresía para un cliente inactivo'
            );
        }

        const plan = await client.query(
            `SELECT id, nombre, precio, moneda, tipo, duracion_dias, estado
             FROM planes
             WHERE id = $1
             FOR SHARE`,
            [plan_id]
        );

        if (plan.rowCount === 0) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(res, 404, 'El plan no existe');
        }

        const datosPlan = plan.rows[0];

        if (datosPlan.estado !== 'activo') {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'No se puede contratar un plan inactivo'
            );
        }

        const fecha_fin = calcularFechaFin(
            inicio,
            datosPlan.tipo,
            datosPlan.duracion_dias
        );

        if (fecha_fin < hoy) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                400,
                'La fecha de fin de la membresía ya pasó'
            );
        }

        // Las membresías vencidas dejan de bloquear nuevas contrataciones.
        await client.query(
            `UPDATE membresias
             SET estado = 'VENCIDA',
                 updated_at = NOW()
             WHERE cliente_id = $1
               AND estado = 'ACTIVA'
               AND fecha_fin < $2::date`,
            [cliente_id, hoy]
        );

        const membresiaActiva = await client.query(
            `SELECT id
             FROM membresias
             WHERE cliente_id = $1
               AND estado = 'ACTIVA'
             LIMIT 1`,
            [cliente_id]
        );

        if (membresiaActiva.rowCount > 0) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'El cliente ya tiene una membresía activa'
            );
        }

        const nueva = await client.query(
            `INSERT INTO membresias (
                cliente_id,
                plan_id,
                fecha_inicio,
                fecha_fin,
                precio,
                moneda,
                tipo_plan,
                duracion_dias,
                estado
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVA')
             RETURNING *`,
            [
                cliente_id,
                plan_id,
                inicio,
                fecha_fin,
                datosPlan.precio,
                datosPlan.moneda,
                datosPlan.tipo,
                datosPlan.duracion_dias,
            ]
        );

        await client.query('COMMIT');
        transaccionIniciada = false;

        return res.status(201).json({
            success: true,
            message: 'Membresía creada correctamente',
            data: nueva.rows[0],
        });
    } catch (error) {
        await revertirTransaccion(client, transaccionIniciada);

        if (error.code === '23505') {
            return responderError(
                res,
                409,
                'El cliente ya tiene una membresía activa'
            );
        }

        console.error('Error al crear membresía:', error);

        return responderError(
            res,
            500,
            'Ocurrió un error al crear la membresía'
        );
    } finally {
        client?.release();
    }
};

// PATCH /api/membresias/:id
// Recalcula la fecha de fin con las condiciones históricas del plan.
export const editarMembresia = async (req, res) => {
    const id = validarId(req, res);

    if (!id) return;

    const validacion = editarMembresiaSchema.safeParse(req.body);

    if (!validacion.success) {
        return responderErrorValidacion(res, validacion.error);
    }

    let client;
    let transaccionIniciada = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transaccionIniciada = true;

        const hoy = await obtenerFechaActual(client);

        const actual = await client.query(
            `SELECT *
             FROM membresias
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (actual.rowCount === 0) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                404,
                'La membresía solicitada no existe'
            );
        }

        const membresia = actual.rows[0];

        if (membresia.estado !== 'ACTIVA') {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'Solo se pueden editar membresías activas y vigentes'
            );
        }

        if (membresia.fecha_fin < hoy) {
            await client.query(
                `UPDATE membresias
                 SET estado = 'VENCIDA',
                     updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );

            await client.query('COMMIT');
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'La membresía venció y su estado se actualizó a VENCIDA'
            );
        }

        const inicio = validacion.data.fecha_inicio;

        if (inicio > hoy) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                400,
                'La fecha de inicio no puede ser futura'
            );
        }

        const fecha_fin = calcularFechaFin(
            inicio,
            membresia.tipo_plan,
            membresia.duracion_dias
        );

        if (fecha_fin < hoy) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                400,
                'La fecha de fin resultante ya pasó'
            );
        }

        const actualizada = await client.query(
            `UPDATE membresias
             SET fecha_inicio = $1,
                 fecha_fin = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [inicio, fecha_fin, id]
        );

        await client.query('COMMIT');
        transaccionIniciada = false;

        return res.status(200).json({
            success: true,
            message: 'Membresía actualizada correctamente',
            data: actualizada.rows[0],
        });
    } catch (error) {
        await revertirTransaccion(client, transaccionIniciada);

        console.error('Error al editar membresía:', error);

        return responderError(
            res,
            500,
            'Ocurrió un error al actualizar la membresía'
        );
    } finally {
        client?.release();
    }
};

// PATCH /api/membresias/:id/estado
export const cambiarEstadoMembresia = async (req, res) => {
    const id = validarId(req, res);

    if (!id) return;

    const validacion = cambiarEstadoMembresiaSchema.safeParse(req.body);

    if (!validacion.success) {
        return responderErrorValidacion(res, validacion.error);
    }

    let client;
    let transaccionIniciada = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transaccionIniciada = true;

        const hoy = await obtenerFechaActual(client);

        const actual = await client.query(
            `SELECT id, estado, fecha_fin
             FROM membresias
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (actual.rowCount === 0) {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                404,
                'La membresía solicitada no existe'
            );
        }

        const membresia = actual.rows[0];

        if (membresia.estado !== 'ACTIVA') {
            await revertirTransaccion(client, transaccionIniciada);
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'Solo se pueden cancelar membresías activas'
            );
        }

        if (membresia.fecha_fin < hoy) {
            await client.query(
                `UPDATE membresias
                 SET estado = 'VENCIDA',
                     updated_at = NOW()
                 WHERE id = $1`,
                [id]
            );

            await client.query('COMMIT');
            transaccionIniciada = false;

            return responderError(
                res,
                409,
                'La membresía ya venció y se actualizó su estado'
            );
        }

        const actualizada = await client.query(
            `UPDATE membresias
             SET estado = 'CANCELADA',
                 updated_at = NOW()
             WHERE id = $1
             RETURNING *`,
            [id]
        );

        await client.query('COMMIT');
        transaccionIniciada = false;

        return res.status(200).json({
            success: true,
            message: 'Membresía cancelada correctamente',
            data: actualizada.rows[0],
        });
    } catch (error) {
        await revertirTransaccion(client, transaccionIniciada);

        console.error('Error al cambiar estado de membresía:', error);

        return responderError(
            res,
            500,
            'Ocurrió un error al cambiar el estado de la membresía'
        );
    } finally {
        client?.release();
    }
};