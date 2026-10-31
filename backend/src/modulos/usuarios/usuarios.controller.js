import { pool } from '../../db.js';
import bcrypt from 'bcrypt';

import {
    crearUsuarioSchema,
    listarUsuariosSchema,
    idUsuarioSchema,
    cambiarEstadoUsuarioSchema,
    cambiarRolesUsuarioSchema
} from './usuarios.schemas.js';

const BLOQUEO_ADMINISTRADORES = [734921, 1];

const responderErrorInterno = (res, mensaje, error) => {
    console.error(mensaje, error.message);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

const validarId = (req, res) => {
    const resultado = idUsuarioSchema.safeParse(req.params);

    if (!resultado.success) {
        res.status(400).json({
            success: false,
            message: 'El ID del usuario no es válido',
            errores: resultado.error.issues.map((issue) => ({
                campo: issue.path.join('.'),
                mensaje: issue.message
            }))
        });

        return null;
    }

    return resultado.data.id;
};

const camposUsuario = `
    id,
    nombre,
    apellido,
    email,
    estado,
    email_verificado,
    created_at AS creado_at,
    updated_at AS actualizado_at
`;

const revertirTransaccion = async (conexion, transaccionIniciada) => {
    if (!conexion || !transaccionIniciada) {
        return;
    }

    try {
        await conexion.query('ROLLBACK');
    } catch (error) {
        console.error('Error al revertir la transacción:', error.message);
    }
};

const bloquearCambiosAdministrativos = async (conexion) => {
    await conexion.query(
        'SELECT pg_advisory_xact_lock($1, $2)',
        BLOQUEO_ADMINISTRADORES
    );
};

const contarAdministradoresActivos = async (conexion) => {
    const resultado = await conexion.query(
        `SELECT COUNT(DISTINCT ur.usuario_id)::INTEGER AS total
         FROM usuario_roles ur
         INNER JOIN roles r ON r.id = ur.rol_id
         INNER JOIN usuarios u ON u.id = ur.usuario_id
         WHERE r.nombre = 'ADMIN'
           AND u.estado = 'activo'`
    );

    return resultado.rows[0].total;
};

export const crearUsuario = async (req, res) => {
    const validacion = crearUsuarioSchema.safeParse(req.body);

    if (!validacion.success) {
        return res.status(400).json({
            success: false,
            message: 'Los datos enviados no son válidos',
            errores: validacion.error.issues.map((issue) => ({
                campo: issue.path.join('.'),
                mensaje: issue.message
            }))
        });
    }

    const {
        nombre,
        apellido,
        email,
        password,
        roles
    } = validacion.data;

    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.connect();

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        const existente = await conexion.query(
            `SELECT id
             FROM usuarios
             WHERE LOWER(email) = $1
             LIMIT 1`,
            [email]
        );

        if (existente.rowCount > 0) {
            await revertirTransaccion(conexion, transaccionIniciada);
            transaccionIniciada = false;

            return res.status(409).json({
                success: false,
                message: 'Ya existe una cuenta con ese correo electrónico'
            });
        }

        const resultadoRoles = await conexion.query(
            `SELECT id, nombre
             FROM roles
             WHERE nombre = ANY($1::VARCHAR[])
             ORDER BY nombre`,
            [roles]
        );

        if (resultadoRoles.rowCount !== roles.length) {
            const rolesEncontrados = new Set(
                resultadoRoles.rows.map((rol) => rol.nombre)
            );

            await revertirTransaccion(conexion, transaccionIniciada);
            transaccionIniciada = false;

            return res.status(400).json({
                success: false,
                message: 'Uno o más roles no existen',
                rolesInvalidos: roles.filter(
                    (rol) => !rolesEncontrados.has(rol)
                )
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const resultadoUsuario = await conexion.query(
            `INSERT INTO usuarios (
                nombre,
                apellido,
                email,
                password_hash
            )
            VALUES ($1, $2, $3, $4)
            RETURNING ${camposUsuario}`,
            [
                nombre,
                apellido,
                email,
                passwordHash
            ]
        );

        const usuario = resultadoUsuario.rows[0];

        for (const rol of resultadoRoles.rows) {
            await conexion.query(
                `INSERT INTO usuario_roles (
                    usuario_id,
                    rol_id
                )
                VALUES ($1, $2)`,
                [usuario.id, rol.id]
            );
        }

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        return res.status(201).json({
            success: true,
            message: 'Usuario creado correctamente',
            usuario: {
                ...usuario,
                roles: resultadoRoles.rows.map((rol) => rol.nombre)
            }
        });
    } catch (error) {
        await revertirTransaccion(conexion, transaccionIniciada);

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una cuenta con ese correo electrónico'
            });
        }

        return responderErrorInterno(
            res,
            'Error al crear usuario:',
            error
        );
    } finally {
        conexion?.release();
    }
};

export const listarUsuarios = async (req, res) => {
    const validacion = listarUsuariosSchema.safeParse(req.query);

    if (!validacion.success) {
        return res.status(400).json({
            success: false,
            message: 'Los filtros enviados no son válidos',
            errores: validacion.error.issues.map((issue) => ({
                campo: issue.path.join('.'),
                mensaje: issue.message
            }))
        });
    }

    const { pagina, limite, buscar, estado } = validacion.data;
    const offset = (pagina - 1) * limite;

    try {
        const condiciones = [];
        const valores = [];

        if (buscar) {
            valores.push(`%${buscar}%`);
            condiciones.push(
                `(nombre ILIKE $${valores.length}
                OR apellido ILIKE $${valores.length}
                OR email ILIKE $${valores.length})`
            );
        }

        if (estado) {
            valores.push(estado);
            condiciones.push(`estado = $${valores.length}`);
        }

        const where = condiciones.length
            ? `WHERE ${condiciones.join(' AND ')}`
            : '';

        const resultadoTotal = await pool.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM usuarios
             ${where}`,
            valores
        );

        const total = resultadoTotal.rows[0].total;
        const valoresListado = [...valores, limite, offset];

        const resultadoUsuarios = await pool.query(
            `SELECT ${camposUsuario}
             FROM usuarios
             ${where}
             ORDER BY created_at DESC, id
             LIMIT $${valores.length + 1}
             OFFSET $${valores.length + 2}`,
            valoresListado
        );

        const ids = resultadoUsuarios.rows.map((usuario) => usuario.id);
        const rolesPorUsuario = new Map(ids.map((id) => [id, []]));

        if (ids.length > 0) {
            const resultadoRoles = await pool.query(
                `SELECT ur.usuario_id, r.nombre AS rol
                 FROM usuario_roles ur
                 INNER JOIN roles r ON r.id = ur.rol_id
                 WHERE ur.usuario_id = ANY($1::UUID[])
                 ORDER BY r.nombre`,
                [ids]
            );

            for (const fila of resultadoRoles.rows) {
                rolesPorUsuario.get(fila.usuario_id)?.push(fila.rol);
            }
        }

        const usuarios = resultadoUsuarios.rows.map((usuario) => ({
            ...usuario,
            roles: rolesPorUsuario.get(usuario.id) ?? []
        }));

        return res.status(200).json({
            success: true,
            data: usuarios,
            paginacion: {
                pagina,
                limite,
                total,
                paginas: Math.ceil(total / limite)
            }
        });
    } catch (error) {
        return responderErrorInterno(
            res,
            'Error al listar usuarios:',
            error
        );
    }
};

export const obtenerUsuario = async (req, res) => {
    const id = validarId(req, res);

    if (!id) {
        return;
    }

    try {
        const resultadoUsuario = await pool.query(
            `SELECT ${camposUsuario}
             FROM usuarios
             WHERE id = $1
             LIMIT 1`,
            [id]
        );

        if (resultadoUsuario.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const [resultadoRoles, resultadoPermisos] = await Promise.all([
            pool.query(
                `SELECT r.nombre
                 FROM usuario_roles ur
                 INNER JOIN roles r ON r.id = ur.rol_id
                 WHERE ur.usuario_id = $1
                 ORDER BY r.nombre`,
                [id]
            ),
            pool.query(
                `SELECT DISTINCT p.codigo
                 FROM usuario_roles ur
                 INNER JOIN rol_permisos rp ON rp.rol_id = ur.rol_id
                 INNER JOIN permisos p ON p.id = rp.permiso_id
                 WHERE ur.usuario_id = $1
                 ORDER BY p.codigo`,
                [id]
            )
        ]);

        return res.status(200).json({
            success: true,
            usuario: {
                ...resultadoUsuario.rows[0],
                roles: resultadoRoles.rows.map((fila) => fila.nombre),
                permisos: resultadoPermisos.rows.map((fila) => fila.codigo)
            }
        });
    } catch (error) {
        return responderErrorInterno(
            res,
            'Error al obtener usuario:',
            error
        );
    }
};

export const cambiarEstadoUsuario = async (req, res) => {
    const id = validarId(req, res);

    if (!id) {
        return;
    }

    const validacion = cambiarEstadoUsuarioSchema.safeParse(req.body);

    if (!validacion.success) {
        return res.status(400).json({
            success: false,
            message: 'El estado enviado no es válido',
            errores: validacion.error.issues.map((issue) => ({
                campo: issue.path.join('.'),
                mensaje: issue.message
            }))
        });
    }

    const { estado } = validacion.data;

    if (id === req.usuario.id && estado !== 'activo') {
        return res.status(400).json({
            success: false,
            message: 'No podés desactivar o bloquear tu propia cuenta'
        });
    }

    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.connect();

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        /*
         * Uso el mismo bloqueo que en los cambios de roles para evitar
         * que dos operaciones simultáneas eliminen al último ADMIN activo.
         */
        await bloquearCambiosAdministrativos(conexion);

        const resultadoUsuario = await conexion.query(
            `SELECT id, estado
             FROM usuarios
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (resultadoUsuario.rowCount === 0) {
            await revertirTransaccion(conexion, transaccionIniciada);
            transaccionIniciada = false;

            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        if (estado !== 'activo') {
            const resultadoEsAdmin = await conexion.query(
                `SELECT EXISTS (
                    SELECT 1
                    FROM usuario_roles ur
                    INNER JOIN roles r ON r.id = ur.rol_id
                    WHERE ur.usuario_id = $1
                      AND r.nombre = 'ADMIN'
                ) AS es_admin`,
                [id]
            );

            if (resultadoEsAdmin.rows[0].es_admin) {
                const totalAdministradores = await contarAdministradoresActivos(
                    conexion
                );

                if (totalAdministradores <= 1) {
                    await revertirTransaccion(conexion, transaccionIniciada);
                    transaccionIniciada = false;

                    return res.status(409).json({
                        success: false,
                        message: 'No se puede desactivar la última cuenta administradora activa'
                    });
                }
            }
        }

        const resultado = await conexion.query(
            `UPDATE usuarios
             SET estado = $2,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING ${camposUsuario}`,
            [id, estado]
        );

        if (estado !== 'activo') {
            await conexion.query(
                `UPDATE sesiones
                 SET revocado_at = NOW()
                 WHERE usuario_id = $1
                   AND revocado_at IS NULL`,
                [id]
            );
        }

        await conexion.query('COMMIT');
        transaccionIniciada = false;

        return res.status(200).json({
            success: true,
            message: 'Estado del usuario actualizado correctamente',
            usuario: resultado.rows[0]
        });
    } catch (error) {
        await revertirTransaccion(conexion, transaccionIniciada);

        return responderErrorInterno(
            res,
            'Error al cambiar estado del usuario:',
            error
        );
    } finally {
        conexion?.release();
    }
};

export const cambiarRolesUsuario = async (req, res) => {
    const id = validarId(req, res);

    if (!id) {
        return;
    }

    const validacion = cambiarRolesUsuarioSchema.safeParse(req.body);

    if (!validacion.success) {
        return res.status(400).json({
            success: false,
            message: 'Los roles enviados no son válidos',
            errores: validacion.error.issues.map((issue) => ({
                campo: issue.path.join('.'),
                mensaje: issue.message
            }))
        });
    }

    const rolesSolicitados = validacion.data.roles;

    if (
        id === req.usuario.id &&
        !rolesSolicitados.includes('ADMIN')
    ) {
        return res.status(400).json({
            success: false,
            message: 'No podés quitarte tu propio rol ADMIN'
        });
    }

    let conexion;
    let transaccionIniciada = false;

    try {
        conexion = await pool.connect();

        await conexion.query('BEGIN');
        transaccionIniciada = true;

        /*
         * Serializo los cambios de roles y estados para proteger
         * la existencia de al menos un administrador activo.
         */
        await bloquearCambiosAdministrativos(conexion);

        const resultadoUsuario = await conexion.query(
            `SELECT id, estado
             FROM usuarios
             WHERE id = $1
             FOR UPDATE`,
            [id]
        );

        if (resultadoUsuario.rowCount === 0) {
            await revertirTransaccion(conexion, transaccionIniciada);
            transaccionIniciada = false;

            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const resultadoRoles = await conexion.query(
            `SELECT id, nombre
             FROM roles
             WHERE nombre = ANY($1::VARCHAR[])
             ORDER BY nombre`,
            [rolesSolicitados]
        );

        if (resultadoRoles.rowCount !== rolesSolicitados.length) {
            await revertirTransaccion(conexion, transaccionIniciada);
            transaccionIniciada = false;

            const rolesEncontrados = new Set(
                resultadoRoles.rows.map((rol) => rol.nombre)
            );

            return res.status(400).json({
                success: false,
                message: 'Uno o más roles no existen',
                rolesInvalidos: rolesSolicitados.filter(
                    (rol) => !rolesEncontrados.has(rol)
                )
            });
        }

        const conservaAdmin = resultadoRoles.rows.some(
            (rol) => rol.nombre === 'ADMIN'
        );

        if (!conservaAdmin) {
            const resultadoAdminActual = await conexion.query(
                `SELECT EXISTS (
                    SELECT 1
                    FROM usuario_roles ur
                    INNER JOIN roles r ON r.id = ur.rol_id
                    WHERE ur.usuario_id = $1
                      AND r.nombre = 'ADMIN'
                ) AS es_admin`,
                [id]
            );

            const usuarioEsAdmin = resultadoAdminActual.rows[0].es_admin;
            const usuarioEstaActivo = resultadoUsuario.rows[0].estado === 'activo';

            if (usuarioEsAdmin && usuarioEstaActivo) {
                const totalAdministradores = await contarAdministradoresActivos(
                    conexion
                );

                if (totalAdministradores <= 1) {
                    await revertirTransaccion(conexion, transaccionIniciada);
                    transaccionIniciada = false;

                    return res.status(409).json({
                        success: false,
                        message: 'No se puede quitar el rol ADMIN a la última cuenta administradora activa'
                    });
                }
            }
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
        transaccionIniciada = false;

        return res.status(200).json({
            success: true,
            message: 'Roles del usuario actualizados correctamente',
            usuario_id: id,
            roles: resultadoRoles.rows.map((rol) => rol.nombre)
        });
    } catch (error) {
        await revertirTransaccion(conexion, transaccionIniciada);

        return responderErrorInterno(
            res,
            'Error al cambiar roles del usuario:',
            error
        );
    } finally {
        conexion?.release();
    }
};