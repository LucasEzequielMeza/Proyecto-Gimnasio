BEGIN;

CREATE TABLE clases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    duracion_minutos INTEGER NOT NULL DEFAULT 60,
    estado VARCHAR(15) NOT NULL DEFAULT 'ACTIVA',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_clases_nombre
        CHECK (LENGTH(TRIM(nombre)) > 0),

    CONSTRAINT chk_clases_duracion
        CHECK (duracion_minutos BETWEEN 5 AND 480),

    CONSTRAINT chk_clases_estado
        CHECK (estado IN ('ACTIVA', 'INACTIVA'))
);

CREATE INDEX idx_clases_estado
    ON clases (estado);

CREATE TABLE sesiones_clase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    clase_id UUID NOT NULL
        REFERENCES clases(id) ON DELETE RESTRICT,

    entrenador_id UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE RESTRICT,

    fecha_inicio TIMESTAMPTZ NOT NULL,
    fecha_fin TIMESTAMPTZ NOT NULL,
    cupo INTEGER NOT NULL,
    estado VARCHAR(15) NOT NULL DEFAULT 'PROGRAMADA',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sesiones_fechas
        CHECK (fecha_fin > fecha_inicio),

    CONSTRAINT chk_sesiones_cupo
        CHECK (cupo > 0),

    CONSTRAINT chk_sesiones_estado
        CHECK (
            estado IN (
                'PROGRAMADA',
                'CANCELADA',
                'FINALIZADA'
            )
        )
);

CREATE INDEX idx_sesiones_clase
    ON sesiones_clase (clase_id);

CREATE INDEX idx_sesiones_entrenador
    ON sesiones_clase (entrenador_id);

CREATE INDEX idx_sesiones_fecha_inicio
    ON sesiones_clase (fecha_inicio);

CREATE INDEX idx_sesiones_estado_fecha
    ON sesiones_clase (estado, fecha_inicio);

CREATE TABLE reservas_clase (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    sesion_id UUID NOT NULL
        REFERENCES sesiones_clase(id) ON DELETE RESTRICT,

    cliente_id UUID NOT NULL
        REFERENCES clientes(id) ON DELETE RESTRICT,

    estado VARCHAR(15) NOT NULL DEFAULT 'RESERVADA',
    fecha_reserva TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelada_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_reservas_estado
        CHECK (
            estado IN (
                'RESERVADA',
                'CANCELADA',
                'ASISTIO',
                'AUSENTE'
            )
        ),

    CONSTRAINT chk_reservas_cancelacion
        CHECK (
            (estado = 'CANCELADA' AND cancelada_at IS NOT NULL)
            OR
            (estado <> 'CANCELADA' AND cancelada_at IS NULL)
        )
);

CREATE UNIQUE INDEX uq_reservas_sesion_cliente_activa
    ON reservas_clase (sesion_id, cliente_id)
    WHERE estado IN ('RESERVADA', 'ASISTIO', 'AUSENTE');

CREATE INDEX idx_reservas_sesion_estado
    ON reservas_clase (sesion_id, estado);

CREATE INDEX idx_reservas_cliente_fecha
    ON reservas_clase (cliente_id, fecha_reserva DESC);

CREATE INDEX idx_reservas_estado
    ON reservas_clase (estado);

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('clases.consultar', 'Consultar clases y sesiones'),
    ('clases.gestionar', 'Crear y modificar clases y sesiones'),
    ('reservas.consultar', 'Consultar reservas'),
    ('reservas.crear', 'Crear reservas propias o administrativas'),
    ('reservas.cancelar', 'Cancelar reservas'),
    ('reservas.gestionar', 'Gestionar reservas y asistencia')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE
    (
        r.nombre = 'ADMIN'
        AND p.codigo IN (
            'clases.consultar',
            'clases.gestionar',
            'reservas.consultar',
            'reservas.crear',
            'reservas.cancelar',
            'reservas.gestionar'
        )
    )
    OR
    (
        r.nombre = 'RECEPCION'
        AND p.codigo IN (
            'clases.consultar',
            'reservas.consultar',
            'reservas.crear',
            'reservas.cancelar',
            'reservas.gestionar'
        )
    )
    OR
    (
        r.nombre = 'ENTRENADOR'
        AND p.codigo IN (
            'clases.consultar',
            'clases.gestionar',
            'reservas.consultar',
            'reservas.gestionar'
        )
    )
    OR
    (
        r.nombre = 'CLIENTE'
        AND p.codigo IN (
            'clases.consultar',
            'reservas.consultar',
            'reservas.crear',
            'reservas.cancelar'
        )
    )
ON CONFLICT DO NOTHING;

COMMIT;