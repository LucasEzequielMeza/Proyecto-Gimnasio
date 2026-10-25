import bcrypt from 'bcrypt';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { pool } from '../../db.js';
import {
    generarTokenDeAcceso,
    DURACION_SESION_SEGUNDOS
} from './jwt.js';
import {
    NOMBRE_COOKIE,
    opcionesCookieBase
} from '../../middleware/autenticacion.middleware.js';

const opcionesCookie = {
    ...opcionesCookieBase,
    maxAge: DURACION_SESION_SEGUNDOS * 1000
};

const generarHash = (valor) => {
    return createHash('sha256').update(valor, 'utf8').digest('hex');
};

const responderUsuario = (usuario) => ({
    id: usuario.id,
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    email: usuario.email,
    estado: usuario.estado,
    email_verificado: usuario.email_verificado
});

const responderErrorInterno = (res, mensajeLog, error) => {
    console.error(mensajeLog, error.message);

    return res.status(500).json({
        success: false,
        message: 'Error interno del servidor'
    });
};

export const registrar = async (req, res) => {
    let conexion;

    try {
        const { nombre, apellido, email, password } = req.body;

        conexion = await pool.connect();
        await conexion.query('BEGIN');

        const existente = await conexion.query(
            `SELECT id
             FROM usuarios
             WHERE LOWER(email) = $1
             LIMIT 1`,
            [email]
        );

        if (existente.rowCount > 0) {
            await conexion.query('ROLLBACK');

            return res.status(409).json({
                success: false,
                message: 'Ya existe una cuenta con ese correo electrónico'
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const resultadoUsuario = await conexion.query(
            `INSERT INTO usuarios (
                nombre, apellido, email, password_hash
             )
             VALUES ($1, $2, $3, $4)
             RETURNING
                id, nombre, apellido, email, estado, email_verificado`,
            [nombre, apellido, email, passwordHash]
        );

        const usuario = resultadoUsuario.rows[0];

        const resultadoRol = await conexion.query(
            `SELECT id FROM roles WHERE nombre = $1 LIMIT 1`,
            ['CLIENTE']
        );

        if (resultadoRol.rowCount === 0) {
            throw new Error('No existe el rol CLIENTE en la base de datos');
        }

        await conexion.query(
            `INSERT INTO usuario_roles (usuario_id, rol_id)
             VALUES ($1, $2)`,
            [usuario.id, resultadoRol.rows[0].id]
        );

        await conexion.query('COMMIT');

        return res.status(201).json({
            success: true,
            message: 'Cuenta creada correctamente',
            usuario: responderUsuario(usuario)
        });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.query('ROLLBACK');
            } catch (errorRollback) {
                console.error('Error al revertir el registro:', errorRollback.message);
            }
        }

        if (error.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Ya existe una cuenta con ese correo electrónico'
            });
        }

        return responderErrorInterno(
            res,
            'Error al registrar el usuario:',
            error
        );
    } finally {
        if (conexion) conexion.release();
    }
};

export const iniciarSesion = async (req, res) => {
    let conexion;

    try {
        const { email, password } = req.body;

        const resultado = await pool.query(
            `SELECT
                id, nombre, apellido, email, password_hash,
                estado, email_verificado
             FROM usuarios
             WHERE LOWER(email) = $1
             LIMIT 1`,
            [email]
        );

        if (resultado.rowCount === 0) {
            return res.status(401).json({
                success: false,
                message: 'Correo electrónico o contraseña incorrectos'
            });
        }

        const usuario = resultado.rows[0];
        const passwordValida = await bcrypt.compare(
            password,
            usuario.password_hash
        );

        if (!passwordValida) {
            return res.status(401).json({
                success: false,
                message: 'Correo electrónico o contraseña incorrectos'
            });
        }

        if (usuario.estado !== 'activo') {
            return res.status(403).json({
                success: false,
                message: 'La cuenta no está habilitada'
            });
        }

        const sesionId = randomUUID();
        const csrfToken = randomBytes(32).toString('hex');
        const csrfTokenHash = generarHash(csrfToken);

        conexion = await pool.connect();
        await conexion.query('BEGIN');

        await conexion.query(
            `INSERT INTO sesiones (
                id, usuario_id, expira_at, csrf_token_hash
             )
             VALUES (
                $1, $2, NOW() + ($3 * INTERVAL '1 second'), $4
             )`,
            [
                sesionId,
                usuario.id,
                DURACION_SESION_SEGUNDOS,
                csrfTokenHash
            ]
        );

        await conexion.query('COMMIT');

        const token = generarTokenDeAcceso(usuario.id, sesionId);

        res.cookie(NOMBRE_COOKIE, token, opcionesCookie);

        return res.status(200).json({
            success: true,
            message: 'Sesión iniciada correctamente',
            usuario: responderUsuario(usuario),
            csrfToken
        });
    } catch (error) {
        if (conexion) {
            try {
                await conexion.query('ROLLBACK');
            } catch (errorRollback) {
                console.error('Error al revertir el inicio de sesión:', errorRollback.message);
            }
        }

        return responderErrorInterno(
            res,
            'Error al iniciar sesión:',
            error
        );
    } finally {
        if (conexion) conexion.release();
    }
};

export const cerrarSesion = async (req, res) => {
    try {
        await pool.query(
            `UPDATE sesiones
             SET revocado_at = NOW()
             WHERE id = $1
               AND usuario_id = $2
               AND revocado_at IS NULL`,
            [req.sesion.id, req.usuario.id]
        );

        res.clearCookie(NOMBRE_COOKIE, opcionesCookieBase);

        return res.status(200).json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });
    } catch (error) {
        return responderErrorInterno(
            res,
            'Error al cerrar sesión:',
            error
        );
    }
};

export const obtenerSesion = (req, res) => {
    return res.status(200).json({
        success: true,
        usuario: responderUsuario(req.usuario),
        roles: req.usuario.roles,
        permisos: req.usuario.permisos
    });
};