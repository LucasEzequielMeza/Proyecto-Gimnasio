export const requiereRol = (...rolesPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                success: false,
                message: 'Se requiere iniciar sesión'
            });
        }

        const tieneRol = rolesPermitidos.some((rol) =>
            req.usuario.roles.includes(rol)
        );

        if (!tieneRol) {
            return res.status(403).json({
                success: false,
                message: 'No tenés permisos para realizar esta operación'
            });
        }

        return next();
    };
};