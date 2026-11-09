import { z } from 'zod';

const uuidSchema = z.string().uuid(
    'El identificador no es válido'
);

export const listarObligacionesSchema = z.object({
    membresia_id: uuidSchema.optional(),

    estado: z.enum([
        'PENDIENTE',
        'PAGADA',
        'VENCIDA',
        'CANCELADA'
    ]).optional(),

    busqueda: z.string()
        .trim()
        .max(100)
        .optional(),

    pagina: z.coerce.number()
        .int()
        .min(1)
        .default(1),

    limite: z.coerce.number()
        .int()
        .min(1)
        .max(100)
        .default(20)
});

export const obtenerObligacionSchema = z.object({
    id: uuidSchema
});