CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE usuarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'activo',
    email_verificado BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_usuarios_email UNIQUE (email),

    CONSTRAINT chk_usuarios_estado
        CHECK (estado IN ('activo', 'inactivo', 'bloqueado'))
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_roles_nombre UNIQUE (nombre)
);

CREATE TABLE permisos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_permisos_codigo UNIQUE (codigo)
);

CREATE TABLE usuario_roles (
    usuario_id UUID NOT NULL,
    rol_id UUID NOT NULL,
    asignado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_usuario_roles
        PRIMARY KEY (usuario_id, rol_id),

    CONSTRAINT fk_usuario_roles_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_usuario_roles_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT
);

CREATE TABLE rol_permisos (
    rol_id UUID NOT NULL,
    permiso_id UUID NOT NULL,
    asignado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pk_rol_permisos
        PRIMARY KEY (rol_id, permiso_id),

    CONSTRAINT fk_rol_permisos_rol
        FOREIGN KEY (rol_id)
        REFERENCES roles(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_rol_permisos_permiso
        FOREIGN KEY (permiso_id)
        REFERENCES permisos(id)
        ON DELETE RESTRICT
);

CREATE INDEX idx_usuario_roles_rol_id
    ON usuario_roles(rol_id);

CREATE INDEX idx_rol_permisos_permiso_id
    ON rol_permisos(permiso_id);

INSERT INTO roles (nombre, descripcion)
VALUES
    ('ADMIN', 'Administración general del gimnasio'),
    ('RECEPCION', 'Gestión operativa de recepción'),
    ('ENTRENADOR', 'Gestión de rutinas y clases asignadas'),
    ('CLIENTE', 'Acceso al portal personal del cliente')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO permisos (codigo, descripcion)
VALUES
    -- Usuarios y seguridad
    ('usuarios.consultar', 'Consultar usuarios'),
    ('usuarios.crear', 'Crear usuarios'),
    ('usuarios.editar', 'Editar usuarios'),
    ('usuarios.desactivar', 'Desactivar usuarios'),
    ('roles.consultar', 'Consultar roles'),
    ('roles.asignar', 'Asignar roles a usuarios'),
    ('permisos.consultar', 'Consultar permisos'),

    -- Clientes
    ('clientes.consultar', 'Consultar clientes'),
    ('clientes.crear', 'Registrar clientes'),
    ('clientes.editar', 'Editar clientes'),
    ('clientes.desactivar', 'Desactivar clientes'),

    -- Planes y membresías
    ('planes.consultar', 'Consultar planes'),
    ('planes.crear', 'Crear planes'),
    ('planes.editar', 'Editar planes'),
    ('membresias.consultar', 'Consultar membresías'),
    ('membresias.crear', 'Crear membresías'),
    ('membresias.editar', 'Editar membresías'),

    -- Pagos
    ('pagos.consultar', 'Consultar pagos'),
    ('pagos.registrar', 'Registrar pagos'),
    ('pagos.reembolsar', 'Gestionar reembolsos'),

    -- Asistencia
    ('asistencias.consultar', 'Consultar asistencias'),
    ('asistencias.registrar', 'Registrar asistencias'),

    -- Rutinas
    ('rutinas.consultar', 'Consultar rutinas'),
    ('rutinas.crear', 'Crear rutinas'),
    ('rutinas.editar', 'Editar rutinas'),

    -- Clases y reservas
    ('clases.consultar', 'Consultar clases'),
    ('clases.gestionar', 'Crear y modificar clases'),
    ('reservas.consultar', 'Consultar reservas'),
    ('reservas.gestionar', 'Gestionar reservas'),

    -- Reportes
    ('reportes.consultar', 'Consultar reportes'),

    -- Auditoría
    ('auditoria.consultar', 'Consultar registros de auditoría')
ON CONFLICT (codigo) DO NOTHING;

-- ADMIN: recibe todos los permisos registrados.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permisos p
WHERE r.nombre = 'ADMIN'
ON CONFLICT DO NOTHING;

-- RECEPCION: operaciones administrativas cotidianas.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN (
    'clientes.consultar',
    'clientes.crear',
    'clientes.editar',
    'membresias.consultar',
    'membresias.crear',
    'membresias.editar',
    'planes.consultar',
    'pagos.consultar',
    'pagos.registrar',
    'asistencias.consultar',
    'asistencias.registrar',
    'clases.consultar',
    'reservas.consultar',
    'reservas.gestionar'
)
WHERE r.nombre = 'RECEPCION'
ON CONFLICT DO NOTHING;

-- ENTRENADOR: rutinas, clases y reservas.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN (
    'asistencias.consultar',
    'clases.consultar',
    'reservas.consultar',
    'rutinas.consultar',
    'rutinas.crear',
    'rutinas.editar'
)
WHERE r.nombre = 'ENTRENADOR'
ON CONFLICT DO NOTHING;

-- CLIENTE: consulta y gestión de sus reservas.
INSERT INTO rol_permisos (rol_id, permiso_id)
SELECT r.id, p.id
FROM roles r
JOIN permisos p ON p.codigo IN (
    'planes.consultar',
    'membresias.consultar',
    'pagos.consultar',
    'asistencias.consultar',
    'rutinas.consultar',
    'clases.consultar',
    'reservas.consultar',
    'reservas.gestionar'
)
WHERE r.nombre = 'CLIENTE'
ON CONFLICT DO NOTHING;

CREATE TABLE schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    descripcion VARCHAR(255) NOT NULL,
    aplicada_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64)
);

INSERT INTO schema_migrations (version, descripcion, checksum)
VALUES (
    '000_initial_baseline',
    'Registro inicial de la estructura existente de ProyectoGym',
    NULL
);