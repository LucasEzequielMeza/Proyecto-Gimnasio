import { z } from 'zod';

const uuidSchema = z.string().uuid(
    'El identificador no es válido'
);

const fechaSchema = z.string()
    .regex(
        /^\d{4}-\d{2}-\d{2}$/,
        'La fecha debe tener el formato YYYY-MM-DD'
    )
    .refine((fecha) => {
        const fechaParseada = new Date(`${fecha}T00:00:00Z`);

        return !Number.isNaN(fechaParseada.getTime()) &&
            fechaParseada.toISOString().slice(0, 10) === fecha;
    }, {
        message: 'La fecha indicada no existe'
    });

export const listarAsistenciasSchema = z.object({
    cliente_id: uuidSchema.optional(),
    fecha_desde: fechaSchema.optional(),
    fecha_hasta: fechaSchema.optional(),
    pagina: z.coerce.number()
        .int()
        .min(1)
        .default(1),
    limite: z.coerce.number()
        .int()
        .min(1)
        .max(100)
        .default(20)
}).refine(
    (datos) => (
        !datos.fecha_desde ||
        !datos.fecha_hasta ||
        datos.fecha_desde <= datos.fecha_hasta
    ),
    {
        message: 'La fecha inicial no puede ser posterior a la fecha final'
    }
);

export const obtenerAsistenciaSchema = z.object({
    id: uuidSchema
});

export const registrarAsistenciaSchema = z.object({
    cliente_id: uuidSchema,
    observaciones: z.string()
        .trim()
        .max(
            250,
            'Las observaciones no pueden superar los 250 caracteres'
        )
        .optional()
        .transform((valor) => valor || null)
});