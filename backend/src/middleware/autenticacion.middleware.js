import { pool } from '../db.js';
import { verificarTokenDeAcceso } from '../modulos/auth/jwt.js';

export const NOMBRE_COOKIE = 'proyectogym_session';

export const opcionesCookieBase = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/'
};

export const limpiarCookie = (res) => {
    res.clearCookie(NOMBRE_COOKIE, opcionesCookieBase);
};

export const estaAutenticado = async (req, res, next) => {
    const token = req.cookies?.[NOMBRE_COOKIE];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Se requiere iniciar sesión'
        });
    }

    let payload;

    try {
        payload = verificarTokenDeAcceso(token);
    } catch {
        limpiarCookie(res);

        return res.status(401).json({
            success: false,
            message: 'La sesión no es válida o ha expirado'
        });
    }

    if (!payload.sub || !payload.jti) {
        limpiarCookie(res);

        return res.status(401).json({
            success: false,
            message: 'La sesión no es válida'
        });
    }

    try {
        const resultado = await pool.query(
            `SELECT
                s.id AS sesion_id,
                s.usuario_id,
                s.expira_at,
                s.csrf_token_hash,
                u.id,
                u.nombre,
                u.apellido,
                u.email,
                u.estado,
                u.email_verificado
             FROM sesiones s
             INNER JOIN usuarios u ON u.id = s.usuario_id
             WHERE s.id = $1
               AND s.usuario_id = $2
               AND s.revocado_at IS NULL
               AND s.expira_at > NOW()
             LIMIT 1`,
            [payload.jti, payload.sub]
        );

        if (resultado.rowCount === 0) {
            limpiarCookie(res);

            return res.status(401).json({
                success: false,
                message: 'La sesión ya no está disponible'
            });
        }

        const fila = resultado.rows[0];

        if (fila.estado !== 'activo') {
            limpiarCookie(res);

            return res.status(403).json({
                success: false,
                message: 'La cuenta no está habilitada'
            });
        }

        const [resultadoRoles, resultadoPermisos] = await Promise.all([
            pool.query(
                `SELECT r.id, r.nombre
                 FROM usuario_roles ur
                 INNER JOIN roles r ON r.id = ur.rol_id
                 WHERE ur.usuario_id = $1
                 ORDER BY r.nombre`,
                [fila.usuario_id]
            ),
            pool.query(
                `SELECT DISTINCT p.codigo
                 FROM usuario_roles ur
                 INNER JOIN rol_permisos rp ON rp.rol_id = ur.rol_id
                 INNER JOIN permisos p ON p.id = rp.permiso_id
                 WHERE ur.usuario_id = $1
                 ORDER BY p.codigo`,
                [fila.usuario_id]
            )
        ]);

        req.usuario = {
            id: fila.id,
            nombre: fila.nombre,
            apellido: fila.apellido,
            email: fila.email,
            estado: fila.estado,
            email_verificado: fila.email_verificado,
            roles: resultadoRoles.rows.map((rol) => rol.nombre),
            permisos: resultadoPermisos.rows.map((permiso) => permiso.codigo)
        };

        req.sesion = {
            id: fila.sesion_id,
            usuario_id: fila.usuario_id,
            expira_at: fila.expira_at,
            csrf_token_hash: fila.csrf_token_hash
        };

        return next();
    } catch (error) {
        console.error(
            'Error al autenticar la solicitud:',
            error.message
        );

        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor'
        });
    }
};