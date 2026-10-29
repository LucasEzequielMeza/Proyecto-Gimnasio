export const requierePermiso = (...permisosRequeridos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: 'Se requiere iniciar sesión'
            });
        }

        if (permisosRequeridos.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'La ruta no tiene permisos configurados'
            });
        }

        const permisosUsuario = req.usuario.permisos ?? [];

        const tieneTodosLosPermisos = permisosRequeridos.every(
            (permiso) => permisosUsuario.includes(permiso)
        );

        if (!tieneTodosLosPermisos) {
            return res.status(403).json({
                success: false,
                message: 'No tenés permisos para realizar esta operación'
            });
        }

        return next();
    };
};