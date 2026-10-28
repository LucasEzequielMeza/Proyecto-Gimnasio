BEGIN;

CREATE TABLE rutinas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cliente_id UUID NOT NULL
        REFERENCES clientes(id) ON DELETE RESTRICT,

    entrenador_id UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE RESTRICT,

    nombre VARCHAR(120) NOT NULL,
    objetivo VARCHAR(250),
    descripcion TEXT,

    fecha_inicio DATE NOT NULL DEFAULT (
        (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
    ),

    fecha_fin DATE,

    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rutinas_estado
        CHECK (estado IN ('ACTIVA', 'FINALIZADA', 'INACTIVA')),

    CONSTRAINT chk_rutinas_fechas
        CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE TABLE rutina_ejercicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    rutina_id UUID NOT NULL
        REFERENCES rutinas(id) ON DELETE RESTRICT,

    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,

    orden INTEGER NOT NULL,
    series SMALLINT NOT NULL,
    repeticiones VARCHAR(50) NOT NULL,
    descanso_segundos SMALLINT,
    observaciones VARCHAR(250),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_rutina_ejercicios_orden
        UNIQUE (rutina_id, orden),

    CONSTRAINT chk_rutina_ejercicios_orden
        CHECK (orden > 0),

    CONSTRAINT chk_rutina_ejercicios_series
        CHECK (series BETWEEN 1 AND 100),

    CONSTRAINT chk_rutina_ejercicios_descanso
        CHECK (
            descanso_segundos IS NULL
            OR descanso_segundos BETWEEN 0 AND 3600
        )
);

CREATE INDEX idx_rutinas_cliente_estado
    ON rutinas (cliente_id, estado);

CREATE INDEX idx_rutinas_entrenador
    ON rutinas (entrenador_id);

CREATE INDEX idx_rutina_ejercicios_rutina_orden
    ON rutina_ejercicios (rutina_id, orden);

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('rutinas.consultar', 'Consultar rutinas'),
    ('rutinas.crear', 'Crear rutinas'),
    ('rutinas.editar', 'Editar rutinas'),
    ('rutinas.asignar', 'Asignar rutinas a clientes'),
    ('rutinas.eliminar', 'Desactivar rutinas')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE
    (
        r.nombre = 'ADMIN'
        AND p.codigo IN (
            'rutinas.consultar',
            'rutinas.crear',
            'rutinas.editar',
            'rutinas.asignar',
            'rutinas.eliminar'
        )
    )
    OR
    (
        r.nombre = 'ENTRENADOR'
        AND p.codigo IN (
            'rutinas.consultar',
            'rutinas.crear',
            'rutinas.editar',
            'rutinas.asignar'
        )
    )
    OR
    (
        r.nombre = 'CLIENTE'
        AND p.codigo = 'rutinas.consultar'
    )
ON CONFLICT DO NOTHING;

COMMIT;