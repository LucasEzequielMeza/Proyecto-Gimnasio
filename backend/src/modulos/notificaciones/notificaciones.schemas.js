import { z } from 'zod';

const uuidSchema = z.string().uuid(
    'El identificador no es válido'
);

export const listarNotificacionesSchema = z.object({
    estado: z.enum([
        'todas',
        'leidas',
        'no_leidas'
    ]).default('todas'),

    tipo: z.enum([
        'MEMBRESIA',
        'PAGO',
        'VENCIMIENTO',
        'RESERVA',
        'SISTEMA'
    ]).optional(),

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

export const obtenerNotificacionSchema = z.object({
    id: uuidSchema
});