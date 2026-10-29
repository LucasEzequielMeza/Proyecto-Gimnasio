export const requierePermiso = (...permisosRequeridos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: 'Se requiere iniciar sesión'
            });
        }

        const permisosUsuario = req.usuario.permisos ?? [];

        const tienePermiso = permisosRequeridos.every((permiso) =>
            permisosUsuario.includes(permiso)
        );

        if (!tienePermiso) {
            return res.status(403).json({
                success: false,
                message: 'No tenés permisos para realizar esta operación'
            });
        }

        return next();
    };
};