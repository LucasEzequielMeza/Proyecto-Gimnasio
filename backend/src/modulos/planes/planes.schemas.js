import { z } from 'zod';

// --------------------------------------------------
// Campos reutilizables
// --------------------------------------------------

const nombreSchema = z
    .string({
        error: (issue) =>
            issue.input === undefined
                ? 'El nombre del plan es obligatorio'
                : 'El nombre debe ser un texto'
    })
    .trim()
    .min(1, 'El nombre del plan es obligatorio')
    .max(100, 'El nombre no puede superar los 100 caracteres');

const descripcionSchema = z
    .string({
        error: 'La descripción debe ser un texto'
    })
    .trim()
    .max(2000, 'La descripción no puede superar los 2000 caracteres')
    .nullable();

const precioSchema = z
    .number({
        error: (issue) =>
            issue.input === undefined
                ? 'El precio es obligatorio'
                : 'El precio debe ser un número'
    })
    .finite('El precio debe ser un número válido')
    .min(0, 'El precio no puede ser negativo')
    .max(9999999999.99, 'El precio supera el máximo permitido')
    .refine(
        (precio) =>
            Math.abs(precio * 100 - Math.round(precio * 100)) < 1e-7,
        'El precio no puede tener más de dos decimales'
    );

const monedaSchema = z
    .string({
        error: 'La moneda debe ser un texto'
    })
    .trim()
    .length(3, 'La moneda debe tener exactamente tres letras')
    .regex(/^[A-Za-z]{3}$/, 'La moneda debe contener solo letras')
    .transform((moneda) => moneda.toUpperCase());

const tipoSchema = z.enum(['FIJO', 'MENSUAL'], {
    error: 'El tipo debe ser FIJO o MENSUAL'
});

const duracionDiasSchema = z
    .number({
        error: 'La duración debe ser un número entero'
    })
    .int('La duración debe ser un número entero')
    .positive('La duración debe ser mayor que cero')
    .max(36500, 'La duración supera el máximo permitido');

const estadoSchema = z.enum(['activo', 'inactivo'], {
    error: 'El estado debe ser activo o inactivo'
});

// --------------------------------------------------
// Listar planes
// --------------------------------------------------

export const listarPlanesSchema = z
    .object({
        pagina: z
            .string()
            .regex(/^[1-9]\d*$/, 'La página debe ser un entero positivo')
            .optional()
            .default('1')
            .transform(Number)
            .pipe(
                z
                    .number()
                    .int()
                    .max(1000000, 'La página supera el máximo permitido')
            ),

        limite: z
            .string()
            .regex(/^[1-9]\d*$/, 'El límite debe ser un entero positivo')
            .optional()
            .default('10')
            .transform(Number)
            .pipe(
                z
                    .number()
                    .int()
                    .min(1)
                    .max(100, 'El límite máximo es de 100 registros')
            ),

        busqueda: z
            .string()
            .trim()
            .max(100, 'La búsqueda no puede superar los 100 caracteres')
            .optional()
            .default(''),

        estado: estadoSchema.optional(),

        tipo: tipoSchema.optional()
    })
    .strict();

// --------------------------------------------------
// Validar ID de plan
// --------------------------------------------------

export const idPlanSchema = z
    .string({
        error: 'El ID del plan debe ser un texto'
    })
    .uuid('El ID del plan no tiene un formato UUID válido');

// --------------------------------------------------
// Crear plan
// --------------------------------------------------

export const crearPlanSchema = z
    .object({
        nombre: nombreSchema,

        descripcion: descripcionSchema.optional(),

        precio: precioSchema,

        moneda: monedaSchema.optional().default('ARS'),

        tipo: tipoSchema,

        duracion_dias: duracionDiasSchema.optional()
    })
    .strict()
    .superRefine((datos, contexto) => {
        if (datos.tipo === 'FIJO' && datos.duracion_dias === undefined) {
            contexto.addIssue({
                code: 'custom',
                path: ['duracion_dias'],
                message:
                    'La duración en días es obligatoria para los planes fijos'
            });
        }

        if (datos.tipo === 'MENSUAL' && datos.duracion_dias !== undefined) {
            contexto.addIssue({
                code: 'custom',
                path: ['duracion_dias'],
                message:
                    'Los planes mensuales no deben especificar duración en días'
            });
        }
    });

// --------------------------------------------------
// Editar plan
// --------------------------------------------------

export const editarPlanSchema = z
    .object({
        nombre: nombreSchema.optional(),

        descripcion: descripcionSchema.optional(),

        precio: precioSchema.optional(),

        moneda: monedaSchema.optional(),

        tipo: tipoSchema.optional(),

        duracion_dias: duracionDiasSchema.nullable().optional()
    })
    .strict()
    .refine((datos) => Object.keys(datos).length > 0, {
        message: 'Debés enviar al menos un campo para actualizar'
    })
    .superRefine((datos, contexto) => {
        if (
            datos.tipo === 'MENSUAL' &&
            datos.duracion_dias != null
        ) {
            contexto.addIssue({
                code: 'custom',
                path: ['duracion_dias'],
                message:
                    'Los planes mensuales no deben especificar duración en días'
            });
        }
    });

// --------------------------------------------------
// Cambiar estado del plan
// --------------------------------------------------

export const cambiarEstadoPlanSchema = z
    .object({
        estado: estadoSchema
    })
    .strict();