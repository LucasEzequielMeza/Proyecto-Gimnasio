BEGIN;

CREATE TABLE membresias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cliente_id UUID NOT NULL
        REFERENCES clientes(id) ON DELETE RESTRICT,

    plan_id UUID NOT NULL
        REFERENCES planes(id) ON DELETE RESTRICT,

    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,

    precio NUMERIC(12, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',

    estado VARCHAR(10) NOT NULL DEFAULT 'ACTIVA',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_membresias_fechas
        CHECK (fecha_fin >= fecha_inicio),

    CONSTRAINT chk_membresias_precio
        CHECK (precio >= 0),

    CONSTRAINT chk_membresias_moneda
        CHECK (moneda ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_membresias_estado
        CHECK (estado IN ('ACTIVA', 'VENCIDA', 'CANCELADA'))
);

CREATE INDEX idx_membresias_cliente
    ON membresias (cliente_id);

CREATE INDEX idx_membresias_plan
    ON membresias (plan_id);

CREATE INDEX idx_membresias_fecha_fin
    ON membresias (fecha_fin);

CREATE INDEX idx_membresias_estado
    ON membresias (estado);

CREATE UNIQUE INDEX uq_membresias_cliente_activa
    ON membresias (cliente_id)
    WHERE estado = 'ACTIVA';

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('membresias.consultar', 'Consultar y listar membresías'),
    ('membresias.crear', 'Registrar nuevas membresías'),
    ('membresias.editar', 'Editar membresías'),
    ('membresias.cancelar', 'Cancelar membresías')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('ADMIN', 'RECEPCION')
  AND p.codigo IN (
      'membresias.consultar',
      'membresias.crear',
      'membresias.editar',
      'membresias.cancelar'
  )
ON CONFLICT DO NOTHING;

COMMIT;