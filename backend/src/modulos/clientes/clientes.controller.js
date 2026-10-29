import { pool } from '../../db.js';

import {
    listarClientesSchema,
    idClienteSchema,
    crearClienteSchema,
    editarClienteSchema,
    cambiarEstadoClienteSchema
} from './clientes.schemas.js';

const camposCliente = `
    id,
    usuario_id,
    nombre,
    apellido,
    documento,
    email,
    telefono,
    fecha_nacimiento,
    direccion,
    contacto_emergencia_nombre,
    contacto_emergencia_telefono,
    observaciones,
    estado,
    created_at AS creado_at,
    updated_at AS actualizado_at
`;

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

const responderError = (res, error) => {
    if (error.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Ya existe un cliente con ese documento, email o cuenta vinculada'
        });
    }

    if (error.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'La cuenta de usuario indicada no existe'
        });
    }

    if (
        error.code === '23514' ||
        error.code === '22007' ||
        error.code === '22008'
    ) {
        return res.status(400).json({
            success: false,
            message: 'Los datos enviados no son válidos'
        });
    }

    console.error('Error en módulo clientes:', error.message);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

export const listarClientes = async (req, res) => {
    try {
        const filtros = listarClientesSchema.parse(req.query);
        const { pagina, limite, buscar, estado } = filtros;
        const offset = (pagina - 1) * limite;

        const condiciones = [];
        const valores = [];

        if (buscar) {
            valores.push(`%${buscar}%`);
            const posicion = valores.length;

            condiciones.push(`(
                nombre ILIKE $${posicion}
                OR apellido ILIKE $${posicion}
                OR COALESCE(documento, '') ILIKE $${posicion}
                OR COALESCE(email, '') ILIKE $${posicion}
                OR COALESCE(telefono, '') ILIKE $${posicion}
            )`);
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(`estado = $${valores.length}`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const consultaTotal = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM clientes
             ${where}`,
            valores
        );

        const total = consultaTotal.rows[0].total;
        const valoresListado = [...valores, limite, offset];

        const consultaClientes = await pool.query(
            `SELECT ${camposCliente}
             FROM clientes
             ${where}
             ORDER BY apellido ASC, nombre ASC
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            valoresListado
        );

        return res.status(200).json({
            success: true,
            data: consultaClientes.rows,
            paginacion: {
                pagina,
                limite,
                total,
                totalPaginas: Math.ceil(total / limite)
            }
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return responderValidacion(
                res,
                error,
                'Los filtros enviados no son válidos'
            );
        }

        return responderError(res, error);
    }
};

export const obtenerCliente = async (req, res) => {
    try {
        const { id } = idClienteSchema.parse(req.params);

        const resultado = await pool.query(
            `SELECT ${camposCliente}
             FROM clientes
             WHERE id = $1`,
            [id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        return res.status(200).json({
            success: true,
            data: resultado.rows[0]
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return responderValidacion(
                res,
                error,
                'El ID del cliente no es válido'
            );
        }

        return responderError(res, error);
    }
};

export const crearCliente = async (req, res) => {
    try {
        const datos = crearClienteSchema.parse(req.body);

        const {
            usuario_id = null,
            nombre,
            apellido,
            documento = null,
            email = null,
            telefono = null,
            fecha_nacimiento = null,
            direccion = null,
            contacto_emergencia_nombre = null,
            contacto_emergencia_telefono = null,
            observaciones = null
        } = datos;

        const resultado = await pool.query(
            `INSERT INTO clientes (
                usuario_id,
                nombre,
                apellido,
                documento,
                email,
                telefono,
                fecha_nacimiento,
                direccion,
                contacto_emergencia_nombre,
                contacto_emergencia_telefono,
                observaciones
            )
            VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
            )
            RETURNING ${camposCliente}`,
            [
                usuario_id,
                nombre,
                apellido,
                documento,
                email,
                telefono,
                fecha_nacimiento,
                direccion,
                contacto_emergencia_nombre,
                contacto_emergencia_telefono,
                observaciones
            ]
        );

        return res.status(201).json({
            success: true,
            message: 'Cliente creado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return responderValidacion(
                res,
                error,
                'Los datos del cliente no son válidos'
            );
        }

        return responderError(res, error);
    }
};

export const editarCliente = async (req, res) => {
    try {
        const { id } = idClienteSchema.parse(req.params);
        const datos = editarClienteSchema.parse(req.body);

        const camposPermitidos = [
            'usuario_id',
            'nombre',
            'apellido',
            'documento',
            'email',
            'telefono',
            'fecha_nacimiento',
            'direccion',
            'contacto_emergencia_nombre',
            'contacto_emergencia_telefono',
            'observaciones'
        ];

        const asignaciones = [];
        const valores = [];

        for (const campo of camposPermitidos) {
            if (Object.hasOwn(datos, campo)) {
                valores.push(datos[campo] ?? null);
                asignaciones.push(`${campo} = $${valores.length}`);
            }
        }

        if (asignaciones.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Tenés que enviar al menos un campo para actualizar'
            });
        }

        valores.push(id);

        const resultado = await pool.query(
            `UPDATE clientes
             SET ${asignaciones.join(', ')},
                 updated_at = NOW()
             WHERE id = $${valores.length}
             RETURNING ${camposCliente}`,
            valores
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Cliente actualizado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return responderValidacion(
                res,
                error,
                'Los datos enviados no son válidos'
            );
        }

        return responderError(res, error);
    }
};

export const cambiarEstadoCliente = async (req, res) => {
    try {
        const { id } = idClienteSchema.parse(req.params);
        const { estado } = cambiarEstadoClienteSchema.parse(req.body);

        const resultado = await pool.query(
            `UPDATE clientes
             SET estado = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING ${camposCliente}`,
            [estado, id]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Cliente no encontrado'
            });
        }

        return res.status(200).json({
            success: true,
            message: estado === 'activo'
                ? 'Cliente activado correctamente'
                : 'Cliente desactivado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return responderValidacion(
                res,
                error,
                'Los datos enviados no son válidos'
            );
        }

        return responderError(res, error);
    }
};