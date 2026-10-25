BEGIN;

INSERT INTO permisos (codigo, descripcion)
VALUES
    ('clientes.consultar', 'Consultar y listar clientes'),
    ('clientes.crear', 'Registrar nuevos clientes'),
    ('clientes.editar', 'Editar datos de clientes'),
    ('clientes.desactivar', 'Activar y desactivar clientes')
ON CONFLICT (codigo) DO NOTHING;

-- ADMIN: todos los permisos de clientes.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'ADMIN'
  AND p.codigo IN (
      'clientes.consultar',
      'clientes.crear',
      'clientes.editar',
      'clientes.desactivar'
  )
ON CONFLICT DO NOTHING;

-- RECEPCION: gestión completa de clientes.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'RECEPCION'
  AND p.codigo IN (
      'clientes.consultar',
      'clientes.crear',
      'clientes.editar',
      'clientes.desactivar'
  )
ON CONFLICT DO NOTHING;

-- ENTRENADOR: solo consulta.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'ENTRENADOR'
  AND p.codigo = 'clientes.consultar'
ON CONFLICT DO NOTHING;

COMMIT;