BEGIN;

CREATE TABLE notificaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    usuario_id UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE CASCADE,

    tipo VARCHAR(30) NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    mensaje TEXT NOT NULL,

    entidad_tipo VARCHAR(50),
    entidad_id UUID,

    clave_unica VARCHAR(200) UNIQUE,

    leida_at TIMESTAMPTZ,
    expira_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notificaciones_tipo
        CHECK (
            tipo IN (
                'MEMBRESIA',
                'PAGO',
                'VENCIMIENTO',
                'RESERVA',
                'SISTEMA'
            )
        ),

    CONSTRAINT chk_notificaciones_titulo
        CHECK (LENGTH(TRIM(titulo)) > 0),

    CONSTRAINT chk_notificaciones_mensaje
        CHECK (LENGTH(TRIM(mensaje)) > 0)
);

CREATE INDEX idx_notificaciones_usuario_fecha
    ON notificaciones (usuario_id, created_at DESC);

CREATE INDEX idx_notificaciones_usuario_no_leidas
    ON notificaciones (usuario_id, created_at DESC)
    WHERE leida_at IS NULL;

CREATE INDEX idx_notificaciones_expiracion
    ON notificaciones (expira_at)
    WHERE expira_at IS NOT NULL;

INSERT INTO permisos (codigo, descripcion)
VALUES
    (
        'notificaciones.consultar',
        'Consultar notificaciones propias'
    ),
    (
        'notificaciones.gestionar',
        'Marcar y eliminar notificaciones propias'
    )
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN (
    'ADMIN',
    'CLIENTE',
    'ENTRENADOR',
    'RECEPCION'
)
AND p.codigo IN (
    'notificaciones.consultar',
    'notificaciones.gestionar'
)
ON CONFLICT DO NOTHING;

COMMIT;