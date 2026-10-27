import { z } from 'zod';

const uuidSchema = z.string().uuid({
    error: 'Debe ser un UUID válido',
});

const fechaSchema = z.iso.date({
    error: 'Debe ser una fecha válida en formato YYYY-MM-DD',
});

export const listarMembresiasSchema = z.object({
    pagina: z.coerce.number()
        .int({ error: 'La página debe ser un número entero' })
        .min(1, { error: 'La página debe ser mayor que cero' })
        .default(1),

    limite: z.coerce.number()
        .int({ error: 'El límite debe ser un número entero' })
        .min(1, { error: 'El límite debe ser mayor que cero' })
        .max(100, { error: 'El límite máximo es 100' })
        .default(10),

    cliente_id: uuidSchema.optional(),
    plan_id: uuidSchema.optional(),

    estado: z.enum(
        ['ACTIVA', 'VENCIDA', 'CANCELADA'],
        { error: 'El estado de membresía no es válido' }
    ).optional(),

    busqueda: z.string()
        .trim()
        .max(100, { error: 'La búsqueda no puede superar los 100 caracteres' })
        .optional(),
});

export const idMembresiaSchema = z.object({
    id: uuidSchema,
});

export const crearMembresiaSchema = z.object({
    cliente_id: uuidSchema,
    plan_id: uuidSchema,
    fecha_inicio: fechaSchema.optional(),
});

export const editarMembresiaSchema = z.object({
    fecha_inicio: fechaSchema,
}).strict();

export const cambiarEstadoMembresiaSchema = z.object({
    estado: z.literal('CANCELADA', {
        error: 'El único cambio de estado permitido es CANCELADA',
    }),
});