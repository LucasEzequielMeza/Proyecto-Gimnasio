/* Impido que una misma obligación tenga más de un pago aprobado. */
CREATE UNIQUE INDEX uq_pagos_obligacion_aprobado
ON pagos(obligacion_id)
WHERE obligacion_id IS NOT NULL
  AND estado = 'APROBADO';