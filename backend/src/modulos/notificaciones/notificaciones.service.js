import { pool } from '../../db.js';

const TIPOS_NOTIFICACION = [
    'MEMBRESIA',
    'PAGO',
    'VENCIMIENTO',
    'RESERVA',
    'SISTEMA'
];

export const crearNotificacion = async ({
    usuarioId,
    tipo,
    titulo,
    mensaje,
    entidadTipo = null,
    entidadId = null,
    claveUnica = null,
    expiraAt = null,
    conexion = pool
}) => {
    if (!usuarioId) {
        throw new Error('El usuario destinatario es obligatorio');
    }

    if (!TIPOS_NOTIFICACION.includes(tipo)) {
        throw new Error('El tipo de notificación no es válido');
    }

    if (!titulo?.trim() || !mensaje?.trim()) {
        throw new Error('El título y el mensaje son obligatorios');
    }

    const resultado = await conexion.query(
        `INSERT INTO notificaciones (
            usuario_id,
            tipo,
            titulo,
            mensaje,
            entidad_tipo,
            entidad_id,
            clave_unica,
            expira_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (clave_unica) DO NOTHING
        RETURNING
            id,
            usuario_id,
            tipo,
            titulo,
            mensaje,
            entidad_tipo,
            entidad_id,
            clave_unica,
            leida_at,
            expira_at,
            created_at`,
        [
            usuarioId,
            tipo,
            titulo.trim(),
            mensaje.trim(),
            entidadTipo,
            entidadId,
            claveUnica,
            expiraAt
        ]
    );

    return resultado.rows[0] ?? null;
};

export const crearNotificaciones = async (
    notificaciones,
    conexion = pool
) => {
    if (!Array.isArray(notificaciones)) {
        throw new Error('Las notificaciones deben enviarse como una lista');
    }

    const resultados = [];

    for (const datos of notificaciones) {
        const notificacion = await crearNotificacion({
            ...datos,
            conexion
        });

        if (notificacion) {
            resultados.push(notificacion);
        }
    }

    return resultados;
};