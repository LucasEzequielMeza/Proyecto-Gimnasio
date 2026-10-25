import { z } from 'zod';

export const listarUsuariosSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).default(''),
    estado: z.enum(['activo', 'inactivo', 'bloqueado']).optional()
}).strict();

export const idUsuarioSchema = z.object({
    id: z.string().uuid('El ID del usuario no es válido')
}).strict();

export const cambiarEstadoUsuarioSchema = z.object({
    estado: z.enum(['activo', 'inactivo', 'bloqueado'])
}).strict();

export const cambiarRolesUsuarioSchema = z.object({
    roles: z.array(
        z.string().trim().min(1).max(50)
    ).min(1).max(20)
        .refine(
            (roles) => new Set(roles).size === roles.length,
            'No se pueden repetir roles'
        )
}).strict();