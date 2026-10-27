import { z } from 'zod';

const uuidSchema = z.string().uuid('El identificador no es válido');

export const listarPagosSchema = z.object({
    membresia_id: uuidSchema.optional(),
    estado: z.enum([
        'PENDIENTE',
        'APROBADO',
        'RECHAZADO',
        'CANCELADO',
        'REEMBOLSADO'
    ]).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20)
});

export const obtenerPagoSchema = z.object({
    id: uuidSchema
});

export const crearPagoSchema = z.object({
    membresia_id: uuidSchema,
    medio_pago: z.enum([
        'EFECTIVO',
        'TRANSFERENCIA',
        'TARJETA',
        'OTRO'
    ])
});