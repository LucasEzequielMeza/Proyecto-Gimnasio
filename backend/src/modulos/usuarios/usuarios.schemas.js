import { z } from 'zod';

const nombreSchema = z.string()
    .trim()
    .min(2, 'Debe tener al menos 2 caracteres')
    .max(100, 'No puede superar los 100 caracteres');

const emailSchema = z.string()
    .trim()
    .email('El correo electrónico no es válido')
    .max(150)
    .transform((email) => email.toLowerCase());

const rolesPersonalSchema = z.array(
    z.enum(['ADMIN', 'RECEPCION', 'ENTRENADOR'])
)
    .min(1, 'Debe asignarse al menos un rol')
    .max(3)
    .refine(
        (roles) => new Set(roles).size === roles.length,
        'No se pueden repetir roles'
    );

export const crearUsuarioSchema = z.object({
    nombre: nombreSchema,
    apellido: nombreSchema,
    email: emailSchema,
    password: z.string()
        .min(12, 'La contraseña debe tener al menos 12 caracteres')
        .max(72, 'La contraseña no puede superar los 72 bytes'),
    roles: rolesPersonalSchema
}).strict();

export const editarUsuarioSchema = z.object({
    nombre: nombreSchema,
    apellido: nombreSchema,
    email: emailSchema
}).strict();

export const listarUsuariosSchema = z.object({
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20),
    buscar: z.string().trim().max(100).optional(),
    estado: z.enum(['activo', 'inactivo', 'bloqueado']).optional()
}).strict();

export const idUsuarioSchema = z.object({
    id: z.string().uuid('El ID del usuario no es válido')
}).strict();

export const cambiarEstadoUsuarioSchema = z.object({
    estado: z.enum(['activo', 'inactivo', 'bloqueado'])
}).strict();

export const cambiarRolesUsuarioSchema = z.object({
    roles: rolesPersonalSchema
}).strict();