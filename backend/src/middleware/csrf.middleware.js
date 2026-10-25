import { createHash, timingSafeEqual } from 'node:crypto';

const obtenerOrigenesPermitidos = () => {
    return (
        process.env.FRONTEND_URL || 'http://localhost:5173'
    )
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean)
        .map((origen) => new URL(origen).origin);
};

export const verificarOrigen = (req, res, next) => {
    const origen = req.get('origin');

    if (!origen) {
        return next();
    }

    let origenNormalizado;

    try {
        origenNormalizado = new URL(origen).origin;
    } catch {
        return res.status(403).json({
            success: false,
            message: 'Origen no permitido'
        });
    }

    if (!obtenerOrigenesPermitidos().includes(origenNormalizado)) {
        return res.status(403).json({
            success: false,
            message: 'Origen no permitido'
        });
    }

    return next();
};

export const verificarCsrf = (req, res, next) => {
    const token = req.get('X-CSRF-Token');
    const hashEsperado = req.sesion?.csrf_token_hash;

    if (
        typeof token !== 'string' ||
        token.length < 32 ||
        !hashEsperado
    ) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF ausente o inválido'
        });
    }

    const hashRecibido = createHash('sha256')
        .update(token, 'utf8')
        .digest('hex');

    const bufferRecibido = Buffer.from(hashRecibido, 'hex');
    const bufferEsperado = Buffer.from(hashEsperado, 'hex');

    if (
        bufferRecibido.length !== bufferEsperado.length ||
        !timingSafeEqual(bufferRecibido, bufferEsperado)
    ) {
        return res.status(403).json({
            success: false,
            message: 'Token CSRF inválido'
        });
    }

    return next();
};