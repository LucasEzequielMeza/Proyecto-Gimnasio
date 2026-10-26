BEGIN;

CREATE TABLE planes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    precio NUMERIC(12, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',

    tipo VARCHAR(10) NOT NULL,
    duracion_dias INTEGER,

    estado VARCHAR(10) NOT NULL DEFAULT 'activo',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_planes_nombre UNIQUE (nombre),

    CONSTRAINT chk_planes_nombre_no_vacio
        CHECK (LENGTH(TRIM(nombre)) > 0),

    CONSTRAINT chk_planes_precio
        CHECK (precio >= 0),

    CONSTRAINT chk_planes_moneda
        CHECK (moneda ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_planes_tipo
        CHECK (tipo IN ('FIJO', 'MENSUAL')),

    CONSTRAINT chk_planes_duracion
        CHECK (
            (tipo = 'FIJO' AND duracion_dias > 0)
            OR
            (tipo = 'MENSUAL' AND duracion_dias IS NULL)
        ),

    CONSTRAINT chk_planes_estado
        CHECK (estado IN ('activo', 'inactivo'))
);

CREATE INDEX idx_planes_estado
    ON planes (estado);

CREATE INDEX idx_planes_tipo
    ON planes (tipo);

INSERT INTO permisos (codigo, descripcion)
VALUES ('planes.desactivar', 'Activar y desactivar planes')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'ADMIN'
  AND p.codigo = 'planes.desactivar'
ON CONFLICT DO NOTHING;

COMMIT;