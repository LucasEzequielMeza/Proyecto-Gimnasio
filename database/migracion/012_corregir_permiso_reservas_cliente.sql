/* Retiro el permiso de gestión de reservas al rol CLIENTE, ya que la asistencia y la gestión administrativa corresponden al personal autorizado. */
DELETE FROM rol_permisos
WHERE rol_id = (
    SELECT id
    FROM roles
    WHERE nombre = 'CLIENTE'
)
AND permiso_id = (
    SELECT id
    FROM permisos
    WHERE codigo = 'reservas.gestionar'
);