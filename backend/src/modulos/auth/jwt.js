import jwt from 'jsonwebtoken';

const EMISOR_JWT = 'proyectogym';
const AUDIENCIA_JWT = 'proyectogym-client';
export const DURACION_SESION_SEGUNDOS = 8 * 60 * 60;

const obtenerSecretoJWT = () => {
    const secreto = process.env.JWT_SECRET;

    if (!secreto || Buffer.byteLength(secreto, 'utf8') < 32) {
        throw new Error('JWT_SECRET debe tener al menos 32 bytes');
    }

    return secreto;
};

export const generarTokenDeAcceso = (usuarioId, sesionId) => {
    return jwt.sign(
        {},
        obtenerSecretoJWT(),
        {
            algorithm: 'HS256',
            subject: usuarioId,
            jwtid: sesionId,
            issuer: EMISOR_JWT,
            audience: AUDIENCIA_JWT,
            expiresIn: DURACION_SESION_SEGUNDOS
        }
    );
};

export const verificarTokenDeAcceso = (token) => {
    return jwt.verify(
        token,
        obtenerSecretoJWT(),
        {
            algorithms: ['HS256'],
            issuer: EMISOR_JWT,
            audience: AUDIENCIA_JWT
        }
    );
};