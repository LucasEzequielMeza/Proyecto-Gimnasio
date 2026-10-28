BEGIN;

CREATE TABLE asistencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    cliente_id UUID NOT NULL
        REFERENCES clientes(id) ON DELETE RESTRICT,

    membresia_id UUID NOT NULL
        REFERENCES membresias(id) ON DELETE RESTRICT,

    fecha DATE NOT NULL DEFAULT (
        NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
    )::DATE,

    fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    registrado_por UUID NOT NULL
        REFERENCES usuarios(id) ON DELETE RESTRICT,

    observaciones VARCHAR(250),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_asistencias_cliente_fecha
        UNIQUE (cliente_id, fecha)
);

CREATE INDEX idx_asistencias_fecha
    ON asistencias (fecha DESC);

CREATE INDEX idx_asistencias_cliente_fecha
    ON asistencias (cliente_id, fecha DESC);

CREATE INDEX idx_asistencias_membresia
    ON asistencias (membresia_id);

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('asistencias.consultar', 'Consultar asistencias'),
    ('asistencias.registrar', 'Registrar asistencias')
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('ADMIN', 'RECEPCION')
  AND p.codigo IN (
      'asistencias.consultar',
      'asistencias.registrar'
  )
ON CONFLICT DO NOTHING;

COMMIT;