CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    usuario_id UUID UNIQUE NULL,

    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    documento VARCHAR(30) NULL,
    email VARCHAR(254) NULL,
    telefono VARCHAR(30) NULL,

    fecha_nacimiento DATE NULL,
    direccion VARCHAR(250) NULL,

    contacto_emergencia_nombre VARCHAR(150) NULL,
    contacto_emergencia_telefono VARCHAR(30) NULL,

    observaciones TEXT NULL,

    estado VARCHAR(20) NOT NULL DEFAULT 'activo',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_clientes_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE SET NULL,

    CONSTRAINT chk_clientes_estado
        CHECK (estado IN ('activo', 'inactivo')),

    CONSTRAINT chk_clientes_nombre
        CHECK (LENGTH(TRIM(nombre)) > 0),

    CONSTRAINT chk_clientes_apellido
        CHECK (LENGTH(TRIM(apellido)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_documento
    ON clientes (documento)
    WHERE documento IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_email_lower
    ON clientes (LOWER(email))
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_nombre_apellido
    ON clientes (LOWER(apellido), LOWER(nombre));

CREATE INDEX IF NOT EXISTS idx_clientes_estado
    ON clientes (estado);

CREATE INDEX IF NOT EXISTS idx_clientes_usuario_id
    ON clientes (usuario_id);