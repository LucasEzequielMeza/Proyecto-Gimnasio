/* Creo una obligación inicial por cada membresía existente, conservando sus importes y períodos. */
INSERT INTO obligaciones_pago (
    membresia_id,
    periodo_inicio,
    periodo_fin,
    fecha_vencimiento,
    monto,
    moneda,
    estado
)
SELECT
    m.id,
    m.fecha_inicio,
    m.fecha_fin,
    m.fecha_inicio,
    m.precio,
    m.moneda,
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM pagos p
            WHERE p.membresia_id = m.id
              AND p.estado = 'APROBADO'
        ) THEN 'PAGADA'
        WHEN m.estado = 'CANCELADA' THEN 'CANCELADA'
        WHEN m.estado = 'VENCIDA' THEN 'VENCIDA'
        ELSE 'PENDIENTE'
    END
FROM membresias m
ON CONFLICT (membresia_id, periodo_inicio) DO NOTHING;

/* Vinculo los pagos existentes con la obligación de su membresía. */
UPDATE pagos p
SET obligacion_id = o.id
FROM membresias m
INNER JOIN obligaciones_pago o
    ON o.membresia_id = m.id
    AND o.periodo_inicio = m.fecha_inicio
WHERE p.membresia_id = m.id
  AND p.obligacion_id IS NULL;