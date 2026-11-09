
/* Creo las obligaciones de pago para separar las deudas de cada período de los intentos de cobro. */
CREATE TABLE obligaciones_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membresia_id UUID NOT NULL,
    periodo_inicio DATE NOT NULL,
    periodo_fin DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    monto NUMERIC(12,2) NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'ARS',
    estado VARCHAR(12) NOT NULL DEFAULT 'PENDIENTE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT obligaciones_pago_membresia_id_fkey
        FOREIGN KEY (membresia_id)
        REFERENCES membresias(id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_obligaciones_pago_periodo
        CHECK (periodo_fin >= periodo_inicio),

    CONSTRAINT chk_obligaciones_pago_monto
        CHECK (monto > 0),

    CONSTRAINT chk_obligaciones_pago_moneda
        CHECK (moneda ~ '^[A-Z]{3}$'),

    CONSTRAINT chk_obligaciones_pago_estado
        CHECK (estado IN ('PENDIENTE', 'PAGADA', 'VENCIDA', 'CANCELADA')),

    CONSTRAINT uq_obligaciones_pago_periodo
        UNIQUE (membresia_id, periodo_inicio)
);

/* Agrego índices para consultar obligaciones por membresía, estado y vencimiento. */
CREATE INDEX idx_obligaciones_pago_membresia
    ON obligaciones_pago(membresia_id);

CREATE INDEX idx_obligaciones_pago_estado_vencimiento
    ON obligaciones_pago(estado, fecha_vencimiento);

/* Vinculo cada operación de pago con su obligación correspondiente. */
ALTER TABLE pagos
ADD COLUMN obligacion_id UUID;

ALTER TABLE pagos
ADD CONSTRAINT pagos_obligacion_id_fkey
    FOREIGN KEY (obligacion_id)
    REFERENCES obligaciones_pago(id)
    ON DELETE RESTRICT;

CREATE INDEX idx_pagos_obligacion
    ON pagos(obligacion_id);
