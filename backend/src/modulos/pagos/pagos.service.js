export async function registrarPagoManual(conexion, datos) {
    const {
        obligacion,
        medio_pago
    } = datos;

    const resultadoPago = await conexion.query(
        `INSERT INTO pagos (
            membresia_id,
            obligacion_id,
            monto,
            moneda,
            proveedor,
            medio_pago,
            estado,
            fecha_pago
        )
        VALUES ($1, $2, $3, $4, 'MANUAL', $5, 'APROBADO', NOW())
        RETURNING
            id,
            membresia_id,
            obligacion_id,
            monto,
            moneda,
            proveedor,
            medio_pago,
            estado,
            proveedor_pago_id,
            fecha_pago,
            created_at,
            updated_at`,
        [
            obligacion.membresia_id,
            obligacion.id,
            obligacion.monto,
            obligacion.moneda,
            medio_pago
        ]
    );

    const resultadoObligacion = await conexion.query(
        `UPDATE obligaciones_pago
         SET estado = 'PAGADA',
             updated_at = NOW()
         WHERE id = $1
           AND estado IN ('PENDIENTE', 'VENCIDA')
         RETURNING id`,
        [obligacion.id]
    );

    if (resultadoObligacion.rowCount !== 1) {
        throw new Error(
            'No se pudo actualizar el estado de la obligación'
        );
    }

    /*
     * Actualizo la fecha de fin de la membresía según el período
     * que se acaba de pagar, sin modificar las membresías canceladas.
     */
    await conexion.query(
        `UPDATE membresias AS m
         SET fecha_fin = GREATEST(m.fecha_fin, o.periodo_fin),
             estado = CASE
                 WHEN m.estado = 'VENCIDA'
                  AND o.periodo_inicio <= (
                      NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                  )::date
                  AND o.periodo_fin >= (
                      NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires'
                  )::date
                 THEN 'ACTIVA'
                 ELSE m.estado
             END,
             updated_at = NOW()
         FROM obligaciones_pago AS o
         WHERE o.id = $1
           AND m.id = o.membresia_id
           AND m.estado IN ('ACTIVA', 'VENCIDA')`,
        [obligacion.id]
    );

    return resultadoPago.rows[0];
}