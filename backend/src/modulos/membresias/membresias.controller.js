import { pool } from '../../db.js';
import {
    listarMembresiasSchema,
    idMembresiaSchema,
    crearMembresiaSchema,
    editarMembresiaSchema,
    cambiarEstadoMembresiaSchema,
} from './membresias.schemas.js';
import { actualizarMembresiasVencidas } from './membresias.vencimientos.js';

const responderErrorValidacion = (res, error) => {
    return res.status(400).json({
        success: false,
        message: 'Los datos enviados no son válidos',
        errores: error.issues,
    });
};

const responderError = (res, status, message) => {
    return res.status(status).json({ success: false, message });
};

const tienePermiso = (req, permiso) =>
    req.usuario?.permisos?.includes(permiso) ?? false;

const esCliente = (req) => req.usuario?.roles?.includes('CLIENTE') ?? false;

const obtenerFechaActual = async (cliente = pool) => {
    const resultado = await cliente.query(
        "SELECT TO_CHAR(CURRENT_DATE, 'YYYY-MM-DD') AS fecha"
    );

    return resultado.rows[0].fecha;
};

const fechaUTC = (fecha) => {
    const [anio, mes, dia] = fecha.split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia));
};

const formatoFechaUTC = (fecha) => {
    const anio = fecha.getUTCFullYear();
    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getUTCDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};

const sumarDias = (fecha, dias) => {
    const resultado = fechaUTC(fecha);
    resultado.setUTCDate(resultado.getUTCDate() + dias);
    return formatoFechaUTC(resultado);
};

const sumarMesesCalendario = (fecha, meses) => {
    const original = fechaUTC(fecha);
    const diaOriginal = original.getUTCDate();
    const destino = new Date(Date.UTC(
        original.getUTCFullYear(),
        original.getUTCMonth() + meses,
        1
    ));
    const ultimoDiaDestino = new Date(Date.UTC(
        destino.getUTCFullYear(),
        destino.getUTCMonth() + 1,
        0
    )).getUTCDate();

    destino.setUTCDate(Math.min(diaOriginal, ultimoDiaDestino));
    return formatoFechaUTC(destino);
};

const calcularFechaFin = (fechaInicio, tipoPlan, duracionDias) => {
    if (tipoPlan === 'FIJO') {
        return sumarDias(fechaInicio, duracionDias - 1);
    }

    return sumarDias(sumarMesesCalendario(fechaInicio, 1), -1);
};

const validarId = (req, res) => {
    const validacion = idMembresiaSchema.safeParse(req.params);

    if (!validacion.success) {
        responderErrorValidacion(res, validacion.error);
        return null;
    }

    return validacion.data.id;
};

const revertirTransaccion = async (cliente, transaccionIniciada) => {
    if (!transaccionIniciada) return;

    try {
        await cliente.query('ROLLBACK');
    } catch (error) {
        console.error('Error al revertir la transacción:', error);
    }
};

const actualizarVencimientosAntesDeOperar = async (res, operacion) => {
    try {
        await actualizarMembresiasVencidas();
        return true;
    } catch (error) {
        console.error(`Error al actualizar vencimientos antes de ${operacion}:`, error);
        responderError(res, 500, 'No se pudieron actualizar los vencimientos de las membresías');
        return false;
    }
};

export const listarMembresias = async (req, res) => {
    const validacion = listarMembresiasSchema.safeParse(req.query);
    if (!validacion.success) return responderErrorValidacion(res, validacion.error);

    const { pagina, limite, cliente_id, plan_id, estado, busqueda } = validacion.data;
    const condiciones = [];
    const valores = [];

    const agregarCondicion = (condicion, valor) => {
        valores.push(valor);
        condiciones.push(condicion.replace('?', `$${valores.length}`));
    };

    if (esCliente(req)) {
        agregarCondicion('c.usuario_id = ?', req.usuario.id);
    } else if (cliente_id) {
        agregarCondicion('m.cliente_id = ?', cliente_id);
    }

    if (plan_id) agregarCondicion('m.plan_id = ?', plan_id);
    if (estado) agregarCondicion('m.estado = ?', estado);

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

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const offset = (pagina - 1) * limite;

    try {
        await actualizarMembresiasVencidas();

        const consulta = `
            SELECT
                m.id, m.cliente_id, m.plan_id, m.fecha_inicio, m.fecha_fin,
                m.precio, m.moneda, m.tipo_plan, m.duracion_dias, m.estado,
                m.created_at, m.updated_at,
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
                pagina, limite, total,
                totalPaginas: Math.ceil(total / limite),
            },
        });
    } catch (error) {
        console.error('Error al listar membresías:', error);
        return responderError(res, 500, 'Ocurrió un error al obtener las membresías');
    }
};

export const obtenerMembresia = async (req, res) => {
    const id = validarId(req, res);
    if (!id) return;

    if (!(await actualizarVencimientosAntesDeOperar(res, 'consultar una membresía'))) return;

    const valores = [id];
    let condicionPropietario = '';
    if (esCliente(req)) {
        valores.push(req.usuario.id);
        condicionPropietario = `AND c.usuario_id = $${valores.length}`;
    }

    try {
        const resultado = await pool.query(`
            SELECT
                m.id, m.cliente_id, m.plan_id, m.fecha_inicio, m.fecha_fin,
                m.precio, m.moneda, m.tipo_plan, m.duracion_dias, m.estado,
                m.created_at, m.updated_at,
                c.nombre AS cliente_nombre,
                c.apellido AS cliente_apellido,
                p.nombre AS plan_nombre
            FROM membresias m
            INNER JOIN clientes c ON c.id = m.cliente_id
            INNER JOIN planes p ON p.id = m.plan_id
            WHERE m.id = $1
            ${condicionPropietario}
            LIMIT 1
        `, valores);

        if (resultado.rows.length === 0) return responderError(res, 404, 'Membresía no encontrada');

        return res.status(200).json({
            success: true,
            message: 'Membresía obtenida correctamente',
            data: resultado.rows[0],
        });
    } catch (error) {
        console.error('Error al obtener membresía:', error);
        return responderError(res, 500, 'Ocurrió un error al obtener la membresía');
    }
};

export const crearMembresia = async (req, res) => {
    if (!tienePermiso(req, 'membresias.crear')) {
        return responderError(res, 403, 'No tenés permiso para crear membresías');
    }

    const validacion = crearMembresiaSchema.safeParse(req.body);
    if (!validacion.success) return responderErrorValidacion(res, validacion.error);

    const { cliente_id, plan_id, fecha_inicio } = validacion.data;
    if (!(await actualizarVencimientosAntesDeOperar(res, 'crear una membresía'))) return;

    const cliente = await pool.connect();
    let transaccionIniciada = false;

    try {
        await cliente.query('BEGIN');
        transaccionIniciada = true;
        const hoy = await obtenerFechaActual(cliente);
        const fechaInicio = fecha_inicio ?? hoy;

        if (fechaInicio > hoy) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 400, 'La fecha de inicio no puede ser futura');
        }

        const resultadoCliente = await cliente.query(`
            SELECT id, estado FROM clientes WHERE id = $1 FOR UPDATE
        `, [cliente_id]);

        if (resultadoCliente.rows.length === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 404, 'Cliente no encontrado');
        }
        if (resultadoCliente.rows[0].estado !== 'activo') {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 409, 'No se puede crear una membresía para un cliente inactivo');
        }

        const resultadoPlan = await cliente.query(`
            SELECT id, nombre, precio, moneda, tipo, duracion_dias, estado
            FROM planes WHERE id = $1 FOR SHARE
        `, [plan_id]);

        if (resultadoPlan.rows.length === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 404, 'Plan no encontrado');
        }
        const plan = resultadoPlan.rows[0];
        if (plan.estado !== 'activo') {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 409, 'No se puede crear una membresía con un plan inactivo');
        }

        const membresiaActiva = await cliente.query(`
            SELECT id FROM membresias
            WHERE cliente_id = $1 AND estado = 'ACTIVA'
            LIMIT 1 FOR UPDATE
        `, [cliente_id]);

        if (membresiaActiva.rows.length > 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 409, 'El cliente ya tiene una membresía activa');
        }

        const fechaFin = calcularFechaFin(fechaInicio, plan.tipo, plan.duracion_dias);
        const resultado = await cliente.query(`
            INSERT INTO membresias (
                cliente_id, plan_id, fecha_inicio, fecha_fin, precio,
                moneda, estado, tipo_plan, duracion_dias
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVA', $7, $8)
            RETURNING *
        `, [cliente_id, plan_id, fechaInicio, fechaFin, plan.precio, plan.moneda, plan.tipo, plan.duracion_dias]);

        await cliente.query('COMMIT');
        transaccionIniciada = false;
        return res.status(201).json({
            success: true,
            message: 'Membresía creada correctamente',
            data: resultado.rows[0],
        });
    } catch (error) {
        await revertirTransaccion(cliente, transaccionIniciada);
        if (error.code === '23505') return responderError(res, 409, 'El cliente ya tiene una membresía activa');
        console.error('Error al crear membresía:', error);
        return responderError(res, 500, 'Ocurrió un error al crear la membresía');
    } finally {
        cliente.release();
    }
};

export const editarMembresia = async (req, res) => {
    if (!tienePermiso(req, 'membresias.editar')) {
        return responderError(res, 403, 'No tenés permiso para editar membresías');
    }

    const id = validarId(req, res);
    if (!id) return;
    const validacion = editarMembresiaSchema.safeParse(req.body);
    if (!validacion.success) return responderErrorValidacion(res, validacion.error);
    const { fecha_inicio } = validacion.data;

    const cliente = await pool.connect();
    let transaccionIniciada = false;

    try {
        await cliente.query('BEGIN');
        transaccionIniciada = true;
        const resultado = await cliente.query(`
            SELECT m.*, TO_CHAR(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin_iso
            FROM membresias m WHERE m.id = $1 FOR UPDATE
        `, [id]);

        if (resultado.rows.length === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 404, 'Membresía no encontrada');
        }
        const membresia = resultado.rows[0];
        if (membresia.estado !== 'ACTIVA') {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 409, 'Solo se pueden editar membresías activas');
        }

        const hoy = await obtenerFechaActual(cliente);
        if (membresia.fecha_fin_iso < hoy) {
            await cliente.query(`
                UPDATE membresias SET estado = 'VENCIDA', updated_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [id]);
            await cliente.query('COMMIT');
            transaccionIniciada = false;
            return responderError(res, 409, 'La membresía ya venció y no puede editarse');
        }
        if (fecha_inicio > hoy) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 400, 'La fecha de inicio no puede ser futura');
        }

        const fechaFin = calcularFechaFin(fecha_inicio, membresia.tipo_plan, membresia.duracion_dias);
        if (fechaFin < hoy) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 400, 'La fecha de fin calculada no puede estar en el pasado');
        }

        const actualizacion = await cliente.query(`
            UPDATE membresias
            SET fecha_inicio = $1, fecha_fin = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
            RETURNING *
        `, [fecha_inicio, fechaFin, id]);

        await cliente.query('COMMIT');
        transaccionIniciada = false;
        return res.status(200).json({
            success: true,
            message: 'Membresía actualizada correctamente',
            data: actualizacion.rows[0],
        });
    } catch (error) {
        await revertirTransaccion(cliente, transaccionIniciada);
        console.error('Error al editar membresía:', error);
        return responderError(res, 500, 'Ocurrió un error al editar la membresía');
    } finally {
        cliente.release();
    }
};

export const cambiarEstadoMembresia = async (req, res) => {
    if (!tienePermiso(req, 'membresias.cancelar')) {
        return responderError(res, 403, 'No tenés permiso para cancelar membresías');
    }

    const id = validarId(req, res);
    if (!id) return;
    const validacion = cambiarEstadoMembresiaSchema.safeParse(req.body);
    if (!validacion.success) return responderErrorValidacion(res, validacion.error);

    const cliente = await pool.connect();
    let transaccionIniciada = false;

    try {
        await cliente.query('BEGIN');
        transaccionIniciada = true;
        const resultado = await cliente.query(`
            SELECT m.*, TO_CHAR(m.fecha_fin, 'YYYY-MM-DD') AS fecha_fin_iso
            FROM membresias m WHERE m.id = $1 FOR UPDATE
        `, [id]);

        if (resultado.rows.length === 0) {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 404, 'Membresía no encontrada');
        }
        const membresia = resultado.rows[0];
        if (membresia.estado !== 'ACTIVA') {
            await revertirTransaccion(cliente, transaccionIniciada);
            transaccionIniciada = false;
            return responderError(res, 409, 'Solo se pueden cancelar membresías activas');
        }

        const hoy = await obtenerFechaActual(cliente);
        if (membresia.fecha_fin_iso < hoy) {
            await cliente.query(`
                UPDATE membresias SET estado = 'VENCIDA', updated_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [id]);
            await cliente.query('COMMIT');
            transaccionIniciada = false;
            return responderError(res, 409, 'La membresía ya venció y se actualizó su estado');
        }

        /* Marco la membresía como cancelada para detener renovaciones, pero conservo el acceso hasta fecha_fin. */
        const actualizacion = await cliente.query(`
            UPDATE membresias
            SET estado = 'CANCELADA', updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `, [id]);

        await cliente.query('COMMIT');
        transaccionIniciada = false;
        return res.status(200).json({
            success: true,
            message: 'Membresía cancelada correctamente',
            data: actualizacion.rows[0],
        });
    } catch (error) {
        await revertirTransaccion(cliente, transaccionIniciada);
        console.error('Error al cancelar membresía:', error);
        return responderError(res, 500, 'Ocurrió un error al cancelar la membresía');
    } finally {
        cliente.release();
    }
};