/* Creo el permiso específico para cancelar obligaciones de pago. */
INSERT INTO permisos (codigo, descripcion)
VALUES (
    'pagos.obligaciones.cancelar',
    'Permite cancelar obligaciones de pago'
)
ON CONFLICT (codigo) DO NOTHING;

/* Asigno el permiso exclusivamente a ADMIN y RECEPCION. */
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT
    r.id,
    p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre IN ('ADMIN', 'RECEPCION')
  AND p.codigo = 'pagos.obligaciones.cancelar'
  AND NOT EXISTS (
      SELECT 1
      FROM rol_permisos rp
      WHERE rp.rol_id = r.id
        AND rp.permiso_id = p.id
  );