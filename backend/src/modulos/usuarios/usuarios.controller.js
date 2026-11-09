import { pool } from '../../db.js';
import bcrypt from 'bcrypt';

import {
    crearUsuarioSchema,
    listarUsuariosSchema,
    idUsuarioSchema,
    cambiarEstadoUsuarioSchema,
    cambiarRolesUsuarioSchema,
    editarUsuarioSchema
} from './usuarios.schemas.js';

const ROLES_PERSONAL = ['ADMIN', 'RECEPCION', 'ENTRENADOR'];

const camposUsuario = `
    u.id,
    u.nombre,
    u.apellido,
    u.email,
    u.estado,
    u.email_verificado,
    u.created_at AS creado_at,
    u.updated_at AS actualizado_at
`;

const responderValidacion = (res, error, mensaje) => {
    const errores = {};

    for (const issue of error.issues) {
        const campo = issue.path.join('.') || 'general';

        if (!errores[campo]) errores[campo] = [];

        errores[campo].push(issue.message);
    }

    return res.status(400).json({
        success: false,
        message: mensaje,
        errors: errores
    });
};

const responderError = (res, error) => {
    if (error.code === '23505') {
        return res.status(409).json({
            success: false,
            message: 'Ya existe un usuario registrado con ese email',
            errors: {
                email: ['El email ya está registrado']
            }
        });
    }

    if (error.code === '23503') {
        return res.status(400).json({
            success: false,
            message: 'La relación solicitada no existe',
            errors: {}
        });
    }

    console.error('Error en módulo usuarios:', error.message);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        errors: {}
    });
};

const bloquearCambiosAdministrativos = async (conexion) => {
    await conexion.query(
        'SELECT pg_advisory_xact_lock($1, $2)',
        [734921, 1]
    );
};

const contarAdministradoresActivos = async (conexion) => {
    const resultado = await conexion.query(
        `SELECT COUNT(DISTINCT u.id)::int AS total
         FROM usuarios u
         INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
         INNER JOIN roles r ON r.id = ur.rol_id
         WHERE u.estado = 'activo'
         AND r.nombre = 'ADMIN'`
    );

    return resultado.rows[0].total;
};

const esUsuarioPersonal = async (conexion, usuarioId) => {
    const resultado = await conexion.query(
        `SELECT EXISTS (
            SELECT 1
            FROM usuario_roles ur
            INNER JOIN roles r ON r.id = ur.rol_id
            WHERE ur.usuario_id = $1
            AND r.nombre = ANY($2::varchar[])
        ) AS permitido`,
        [usuarioId, ROLES_PERSONAL]
    );

    return resultado.rows[0].permitido;
};

export const listarRoles = async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nombre, descripcion
             FROM roles
             WHERE nombre = ANY($1::varchar[])
             ORDER BY nombre`,
            [ROLES_PERSONAL]
        );

        return res.status(200).json({
            success: true,
            data: resultado.rows
        });
    } catch (error) {
        return responderError(res, error);
    }
};

export const listarUsuarios = async (req, res) => {
    try {
        const filtros = listarUsuariosSchema.parse(req.query);
        const { pagina, limite, buscar, estado } = filtros;
        const offset = (pagina - 1) * limite;

        const condiciones = [
            `EXISTS (
                SELECT 1
                FROM usuario_roles ur
                INNER JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id = u.id
                AND r.nombre = ANY($1::varchar[])
            )`
        ];

        const valores = [ROLES_PERSONAL];

        if (buscar) {
            valores.push(`%${buscar}%`);
            const posicion = valores.length;

            condiciones.push(`(
                u.nombre ILIKE $${posicion}
                OR u.apellido ILIKE $${posicion}
                OR u.email ILIKE $${posicion}
            )`);
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(`u.estado = $${valores.length}`);
        }

        const where = `WHERE ${condiciones.join(' AND ')}`;

        const consultaTotal = await pool.query(
            `SELECT COUNT(*)::int AS total
             FROM usuarios u
             ${where}`,
            valores
        );

        const total = consultaTotal.rows[0].total;

        const consulta = await pool.query(
            `SELECT ${camposUsuario},
                COALESCE(
                    ARRAY_AGG(DISTINCT r.nombre)
                    FILTER (WHERE r.nombre IS NOT NULL),
                    ARRAY[]::varchar[]
                ) AS roles
             FROM usuarios u
             INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
             INNER JOIN roles r ON r.id = ur.rol_id
             ${where}
             AND r.nombre = ANY($1::varchar[])
             GROUP BY u.id
             ORDER BY u.apellido, u.nombre
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            [...valores, limite, offset]
        );

        return res.status(200).json({
            success: true,
            data: consulta.rows,
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

export const obtenerUsuario = async (req, res) => {
    try {
        const { id } = idUsuarioSchema.parse(req.params);

        const resultado = await pool.query(
            `SELECT ${camposUsuario},
                COALESCE(
                    ARRAY_AGG(DISTINCT r.nombre)
                    FILTER (WHERE r.nombre IS NOT NULL),
                    ARRAY[]::varchar[]
                ) AS roles,
                COALESCE(
                    ARRAY_AGG(DISTINCT p.codigo)
                    FILTER (WHERE p.codigo IS NOT NULL),
                    ARRAY[]::varchar[]
                ) AS permisos
             FROM usuarios u
             INNER JOIN usuario_roles ur ON ur.usuario_id = u.id
             INNER JOIN roles r ON r.id = ur.rol_id
             LEFT JOIN rol_permisos rp ON rp.rol_id = r.id
             LEFT JOIN permisos p ON p.id = rp.permiso_id
             WHERE u.id = $1
             AND r.nombre = ANY($2::varchar[])
             GROUP BY u.id`,
            [id, ROLES_PERSONAL]
        );

        if (resultado.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        return res.status(200).json({
            success: true,
            data: resultado.rows[0]
        });
    } catch (error) {
        if (error.name === 'ZodError') {
            return responderValidacion(res, error, 'El ID no es válido');
        }

        return responderError(res, error);
    }
};

export const crearUsuario = async (req, res) => {
    const conexion = await pool.connect();

    try {
        const datos = crearUsuarioSchema.parse(req.body);

        const {
            nombre,
            apellido,
            email,
            password,
            roles
        } = datos;

        if (
            !Array.isArray(roles) ||
            roles.length === 0 ||
            roles.some((rol) => !ROLES_PERSONAL.includes(rol))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden asignar roles del personal',
                errors: {}
            });
        }

        await conexion.query('BEGIN');

        const passwordHash = await bcrypt.hash(password, 12);

        const resultadoUsuario = await conexion.query(
            `INSERT INTO usuarios (
                nombre,
                apellido,
                email,
                password_hash
            )
            VALUES ($1, $2, $3, $4)
            RETURNING id`,
            [nombre, apellido, email, passwordHash]
        );

        const usuarioId = resultadoUsuario.rows[0].id;

        const resultadoRoles = await conexion.query(
            `SELECT id, nombre
             FROM roles
             WHERE nombre = ANY($1::varchar[])`,
            [roles]
        );

        if (resultadoRoles.rowCount !== roles.length) {
            throw new Error('Uno o más roles no existen');
        }

        for (const rol of resultadoRoles.rows) {
            await conexion.query(
                `INSERT INTO usuario_roles (usuario_id, rol_id)
                 VALUES ($1, $2)`,
                [usuarioId, rol.id]
            );
        }

        await conexion.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Usuario creado correctamente',
            data: {
                id: usuarioId,
                nombre,
                apellido,
                email,
                roles
            }
        });
    } catch (error) {
        await conexion.query('ROLLBACK');

        if (error.name === 'ZodError') {
            return responderValidacion(
                res,
                error,
                'Los datos del usuario no son válidos'
            );
        }

        return responderError(res, error);
    } finally {
        conexion.release();
    }
};

export const editarUsuario = async (req, res) => {
    try {
        const { id } = idUsuarioSchema.parse(req.params);
        const datos = editarUsuarioSchema.parse(req.body);

        const permitido = await esUsuarioPersonal(pool, id);

        if (!permitido) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const campos = ['nombre', 'apellido', 'email'];
        const asignaciones = [];
        const valores = [];

        for (const campo of campos) {
            if (Object.hasOwn(datos, campo)) {
                valores.push(datos[campo]);
                asignaciones.push(`${campo} = $${valores.length}`);
            }
        }

        if (asignaciones.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No hay datos para actualizar'
            });
        }

        valores.push(id);

        const resultado = await pool.query(
            `UPDATE usuarios
             SET ${asignaciones.join(', ')},
                 updated_at = NOW()
             WHERE id = $${valores.length}
             RETURNING id, nombre, apellido, email, estado, updated_at`,
            valores
        );

        return res.status(200).json({
            success: true,
            message: 'Usuario actualizado correctamente',
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

export const cambiarEstadoUsuario = async (req, res) => {
    const conexion = await pool.connect();

    try {
        const { id } = idUsuarioSchema.parse(req.params);
        const { estado } = cambiarEstadoUsuarioSchema.parse(req.body);

        await conexion.query('BEGIN');
        await bloquearCambiosAdministrativos(conexion);

        const usuario = await conexion.query(
            `SELECT u.id, u.estado
             FROM usuarios u
             WHERE u.id = $1
             AND EXISTS (
                SELECT 1
                FROM usuario_roles ur
                INNER JOIN roles r ON r.id = ur.rol_id
                WHERE ur.usuario_id = u.id
                AND r.nombre = ANY($2::varchar[])
             )
             FOR UPDATE`,
            [id, ROLES_PERSONAL]
        );

        if (usuario.rowCount === 0) {
            await conexion.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const rolesUsuario = await conexion.query(
            `SELECT r.nombre
             FROM usuario_roles ur
             INNER JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = $1`,
            [id]
        );

        const esAdmin = rolesUsuario.rows.some(
            (rol) => rol.nombre === 'ADMIN'
        );

        if (
            esAdmin &&
            usuario.rows[0].estado === 'activo' &&
            estado !== 'activo'
        ) {
            const totalAdmins = await contarAdministradoresActivos(conexion);

            if (totalAdmins <= 1) {
                await conexion.query('ROLLBACK');

                return res.status(409).json({
                    success: false,
                    message: 'No podés desactivar al último administrador activo'
                });
            }
        }

        const resultado = await conexion.query(
            `UPDATE usuarios
             SET estado = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING id, nombre, apellido, email, estado, updated_at`,
            [estado, id]
        );

        if (estado !== 'activo') {
            await conexion.query(
                `DELETE FROM sesiones
                 WHERE usuario_id = $1`,
                [id]
            );
        }

        await conexion.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: estado === 'activo'
                ? 'Usuario activado correctamente'
                : 'Usuario desactivado correctamente',
            data: resultado.rows[0]
        });
    } catch (error) {
        await conexion.query('ROLLBACK');

        if (error.name === 'ZodError') {
            return responderValidacion(res, error, 'Los datos no son válidos');
        }

        return responderError(res, error);
    } finally {
        conexion.release();
    }
};

export const cambiarRolesUsuario = async (req, res) => {
    const conexion = await pool.connect();

    try {
        const { id } = idUsuarioSchema.parse(req.params);
        const { roles } = cambiarRolesUsuarioSchema.parse(req.body);

        if (
            !Array.isArray(roles) ||
            roles.length === 0 ||
            roles.some((rol) => !ROLES_PERSONAL.includes(rol))
        ) {
            return res.status(400).json({
                success: false,
                message: 'Solo se pueden asignar roles del personal',
                errors: {}
            });
        }

        await conexion.query('BEGIN');
        await bloquearCambiosAdministrativos(conexion);

        const usuario = await conexion.query(
            `SELECT id
             FROM usuarios
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (usuario.rowCount === 0) {
            await conexion.query('ROLLBACK');

            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const rolesActuales = await conexion.query(
            `SELECT r.nombre
             FROM usuario_roles ur
             INNER JOIN roles r ON r.id = ur.rol_id
             WHERE ur.usuario_id = $1`,
            [id]
        );

        const teniaAdmin = rolesActuales.rows.some(
            (rol) => rol.nombre === 'ADMIN'
        );

        const tendraAdmin = roles.includes('ADMIN');

        if (teniaAdmin && !tendraAdmin) {
            const estadoUsuario = await conexion.query(
                `SELECT estado FROM usuarios WHERE id = $1`,
                [id]
            );

            if (estadoUsuario.rows[0].estado === 'activo') {
                const totalAdmins = await contarAdministradoresActivos(conexion);

                if (totalAdmins <= 1) {
                    await conexion.query('ROLLBACK');

                    return res.status(409).json({
                        success: false,
                        message: 'No podés quitar el rol del último administrador activo'
                    });
                }
            }
        }

        const resultadoRoles = await conexion.query(
            `SELECT id, nombre
             FROM roles
             WHERE nombre = ANY($1::varchar[])`,
            [roles]
        );

        if (resultadoRoles.rowCount !== roles.length) {
            throw new Error('Uno o más roles no existen');
        }

        await conexion.query(
            `DELETE FROM usuario_roles
             WHERE usuario_id = $1`,
            [id]
        );

        for (const rol of resultadoRoles.rows) {
            await conexion.query(
                `INSERT INTO usuario_roles (usuario_id, rol_id)
                 VALUES ($1, $2)`,
                [id, rol.id]
            );
        }

        await conexion.query('COMMIT');

        return res.status(200).json({
            success: true,
            message: 'Roles actualizados correctamente',
            data: {
                usuario_id: id,
                roles
            }
        });
    } catch (error) {
        await conexion.query('ROLLBACK');

        if (error.name === 'ZodError') {
            return responderValidacion(res, error, 'Los roles no son válidos');
        }

        return responderError(res, error);
    } finally {
        conexion.release();
    }
};