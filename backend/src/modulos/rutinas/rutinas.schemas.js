import { z } from 'zod';

const uuidSchema = z.string().uuid(
    'El identificador no es válido'
);

const textoRequerido = (maximo, mensaje) => z.string()
    .trim()
    .min(1, 'Este campo es obligatorio')
    .max(maximo, mensaje);

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

const ejercicioSchema = z.object({
    nombre: textoRequerido(
        120,
        'El nombre del ejercicio no puede superar los 120 caracteres'
    ),
    descripcion: z.string()
        .trim()
        .max(2000, 'La descripción no puede superar los 2000 caracteres')
        .optional()
        .transform((valor) => valor || null),
    orden: z.coerce.number()
        .int()
        .min(1, 'El orden debe ser mayor que cero'),
    series: z.coerce.number()
        .int()
        .min(1, 'Debe indicarse al menos una serie')
        .max(100, 'No se permiten más de 100 series'),
    repeticiones: textoRequerido(
        50,
        'Las repeticiones no pueden superar los 50 caracteres'
    ),
    descanso_segundos: z.coerce.number()
        .int()
        .min(0)
        .max(3600)
        .nullable()
        .optional()
        .transform((valor) => valor ?? null),
    observaciones: z.string()
        .trim()
        .max(250, 'Las observaciones no pueden superar los 250 caracteres')
        .optional()
        .transform((valor) => valor || null)
});

const ejerciciosSchema = z.array(ejercicioSchema)
    .min(1, 'La rutina debe tener al menos un ejercicio')
    .max(100, 'La rutina no puede superar los 100 ejercicios')
    .refine(
        (ejercicios) => (
            new Set(ejercicios.map((ejercicio) => ejercicio.orden)).size ===
            ejercicios.length
        ),
        {
            message: 'No puede haber dos ejercicios con el mismo orden'
        }
    );

const datosRutinaSchema = z.object({
    cliente_id: uuidSchema,
    nombre: textoRequerido(
        120,
        'El nombre no puede superar los 120 caracteres'
    ),
    objetivo: z.string()
        .trim()
        .max(250, 'El objetivo no puede superar los 250 caracteres')
        .optional()
        .transform((valor) => valor || null),
    descripcion: z.string()
        .trim()
        .max(5000, 'La descripción no puede superar los 5000 caracteres')
        .optional()
        .transform((valor) => valor || null),
    fecha_inicio: fechaSchema.optional(),
    fecha_fin: fechaSchema.nullable().optional(),
    ejercicios: ejerciciosSchema
});

export const listarRutinasSchema = z.object({
    cliente_id: uuidSchema.optional(),
    entrenador_id: uuidSchema.optional(),
    estado: z.enum([
        'ACTIVA',
        'FINALIZADA',
        'INACTIVA'
    ]).optional(),
    pagina: z.coerce.number().int().min(1).default(1),
    limite: z.coerce.number().int().min(1).max(100).default(20)
});

export const obtenerRutinaSchema = z.object({
    id: uuidSchema
});

export const crearRutinaSchema = datosRutinaSchema.refine(
    (datos) => (
        !datos.fecha_inicio ||
        !datos.fecha_fin ||
        datos.fecha_fin >= datos.fecha_inicio
    ),
    {
        message: 'La fecha final no puede ser anterior a la fecha inicial',
        path: ['fecha_fin']
    }
);

export const editarRutinaSchema = z.object({
    nombre: textoRequerido(
        120,
        'El nombre no puede superar los 120 caracteres'
    ).optional(),
    objetivo: z.string()
        .trim()
        .max(250, 'El objetivo no puede superar los 250 caracteres')
        .nullable()
        .optional(),
    descripcion: z.string()
        .trim()
        .max(5000, 'La descripción no puede superar los 5000 caracteres')
        .nullable()
        .optional(),
    fecha_inicio: fechaSchema.optional(),
    fecha_fin: fechaSchema.nullable().optional(),
    ejercicios: ejerciciosSchema.optional()
}).refine(
    (datos) => Object.keys(datos).length > 0,
    {
        message: 'Debés enviar al menos un campo para actualizar'
    }
);

export const cambiarEstadoRutinaSchema = z.object({
    estado: z.enum([
        'ACTIVA',
        'FINALIZADA',
        'INACTIVA'
    ], {
        message: 'El estado indicado no es válido'
    })
});

export const asignarRutinaSchema = z.object({
    cliente_id: uuidSchema
});