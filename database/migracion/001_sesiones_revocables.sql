CREATE TABLE sesiones (
    id UUID PRIMARY KEY,
    usuario_id UUID NOT NULL,
    creado_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_at TIMESTAMPTZ NOT NULL,
    revocado_at TIMESTAMPTZ,
    csrf_token_hash VARCHAR(64) NOT NULL,

    CONSTRAINT fk_sesiones_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_sesiones_expiracion
        CHECK (expira_at > creado_at)
);

CREATE INDEX idx_sesiones_usuario_id
    ON sesiones(usuario_id);

CREATE INDEX idx_sesiones_expiracion
    ON sesiones(expira_at);