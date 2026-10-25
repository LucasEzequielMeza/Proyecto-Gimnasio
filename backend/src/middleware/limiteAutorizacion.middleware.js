import { rateLimit } from 'express-rate-limit';

export const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Demasiados intentos de inicio de sesión. Intentá nuevamente más tarde.'
    }
});

export const limiteRegistro = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
        success: false,
        message: 'Se alcanzó el límite de registros. Intentá nuevamente más tarde.'
    }
});