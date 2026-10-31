import { z } from 'zod';

const nombreSchema = z.string()
    .trim()
    .min(2, 'Debe tener al menos 2 caracteres')
    .max(100, 'No puede superar los 100 caracteres')
    .regex(
        /^[\p{L}\p{M}\s'-]+$/u,
        'Contiene caracteres no permitidos'
    );

const emailSchema = z.string()
    .trim()
    .email('Ingresá un correo electrónico válido')
    .max(254, 'El correo electrónico es demasiado largo')
    .transform((email) => email.toLowerCase());

const passwordSchema = z.string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres')
    .max(72, 'La contraseña no puede superar los 72 caracteres')
    .refine(
        (password) => Buffer.byteLength(password, 'utf8') <= 72,
        'La contraseña supera el límite permitido'
    );

export const crearUsuarioSchema = z.object({
    nombre: nombreSchema,
    apellido: nombreSchema,
    email: emailSchema,
    password: passwordSchema,
    roles: z.array(
        z.enum(['ADMIN', 'CLIENTE', 'ENTRENADOR', 'RECEPCION'])
    )
        .min(1, 'Debe asignarse al menos un rol')
        .max(4, 'No se pueden asignar más de cuatro roles')
        .refine(
            (roles) => new Set(roles).size === roles.length,
            'No se pueden repetir roles'
        )
}).strict();

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