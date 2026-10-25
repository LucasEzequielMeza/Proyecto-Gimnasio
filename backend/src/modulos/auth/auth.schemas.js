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

const contrasenaRegistroSchema = z.string()
    .min(12, 'La contraseña debe tener al menos 12 caracteres')
    .max(72, 'La contraseña no puede superar los 72 caracteres')
    .refine(
        (contrasena) => Buffer.byteLength(contrasena, 'utf8') <= 72,
        'La contraseña supera el límite permitido'
    );

export const registroSchema = z.object({
    nombre: nombreSchema,
    apellido: nombreSchema,
    email: emailSchema,
    password: contrasenaRegistroSchema
}).strict();

export const loginSchema = z.object({
    email: emailSchema,
    password: z.string()
        .min(1, 'Ingresá tu contraseña')
        .max(72, 'La contraseña es demasiado larga')
        .refine(
            (contrasena) => Buffer.byteLength(contrasena, 'utf8') <= 72,
            'La contraseña es demasiado larga'
        )
}).strict();