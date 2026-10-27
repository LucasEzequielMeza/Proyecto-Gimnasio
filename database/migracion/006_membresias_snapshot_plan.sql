BEGIN;

ALTER TABLE membresias
    ADD COLUMN tipo_plan VARCHAR(10),
    ADD COLUMN duracion_dias INTEGER;

-- Completar las condiciones históricas usando el plan asociado.
UPDATE membresias m
SET tipo_plan = p.tipo,
    duracion_dias = p.duracion_dias
FROM planes p
WHERE p.id = m.plan_id;

-- Exigir los valores para las nuevas membresías.
ALTER TABLE membresias
    ALTER COLUMN tipo_plan SET NOT NULL;

ALTER TABLE membresias
    ADD CONSTRAINT chk_membresias_tipo_plan
        CHECK (tipo_plan IN ('FIJO', 'MENSUAL')),
    ADD CONSTRAINT chk_membresias_duracion
        CHECK (
            (tipo_plan = 'FIJO' AND duracion_dias > 0)
            OR
            (tipo_plan = 'MENSUAL' AND duracion_dias IS NULL)
        );

COMMIT;