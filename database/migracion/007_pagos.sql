BEGIN;

CREATE TABLE pagos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    membresia_id UUID NOT NULL
        REFERENCES membresias(id) ON DELETE RESTRICT,

    monto NUMERIC(12, 2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',

    proveedor VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    medio_pago VARCHAR(20),

    estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',

    proveedor_pago_id VARCHAR(150),
    clave_idempotencia VARCHAR(150),

    fecha_pago TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_pagos_monto
        CHECK (monto > 0),

    CONSTRAINT chk_pagos_moneda
        CHECK (moneda ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_pagos_proveedor
        CHECK (proveedor IN ('MANUAL', 'MERCADO_PAGO')),

    CONSTRAINT chk_pagos_medio
        CHECK (
            medio_pago IS NULL
            OR medio_pago IN (
                'EFECTIVO',
                'TRANSFERENCIA',
                'TARJETA',
                'OTRO'
            )
        ),

    CONSTRAINT chk_pagos_estado
        CHECK (
            estado IN (
                'PENDIENTE',
                'APROBADO',
                'RECHAZADO',
                'CANCELADO',
                'REEMBOLSADO'
            )
        )
);

CREATE INDEX idx_pagos_membresia
    ON pagos (membresia_id);

CREATE INDEX idx_pagos_estado
    ON pagos (estado);

CREATE INDEX idx_pagos_created_at
    ON pagos (created_at DESC);

CREATE UNIQUE INDEX uq_pagos_proveedor_id
    ON pagos (proveedor, proveedor_pago_id)
    WHERE proveedor_pago_id IS NOT NULL;

CREATE UNIQUE INDEX uq_pagos_clave_idempotencia
    ON pagos (clave_idempotencia)
    WHERE clave_idempotencia IS NOT NULL;

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('pagos.consultar', 'Consultar pagos'),
    ('pagos.registrar', 'Registrar pagos')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('ADMIN', 'RECEPCION')
  AND p.codigo IN (
      'pagos.consultar',
      'pagos.registrar'
  )
ON CONFLICT DO NOTHING;

COMMIT;