export const validateSchema = (schema, fuente = 'body') => {
    return (req, res, next) => {
        const resultado = schema.safeParse(req[fuente]);

        if (!resultado.success) {
            const errores = {};

            for (const error of resultado.error.issues) {
                const campo = error.path.join('.') || 'general';

                if (!errores[campo]) {
                    errores[campo] = [];
                }

                errores[campo].push(error.message);
            }

            return res.status(400).json({
                success: false,
                message: 'Los datos enviados no son válidos',
                errors: errores
            });
        }

        req[fuente] = resultado.data;

        return next();
    };
};