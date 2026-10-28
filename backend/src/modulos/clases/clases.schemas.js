import { z } from 'zod';

const uuidSchema = z.string().uuid('El identificador no es válido');

const textoObligatorio = (maximo) =>
    z.string()
        .trim()
        .min(1, 'Este campo es obligatorio')
        .max(maximo, `El máximo permitido es ${maximo} caracteres`);

const fechaSchema = z.string()
    .datetime({
        offset: true,
        message: 'La fecha debe incluir una zona horaria válida'
    });

const paginacionSchema = {
    pagina: z.coerce.number()
        .int('La página debe ser un número entero')
        .min(1, 'La página mínima es 1')
        .default(1),

    limite: z.coerce.number()
        .int('El límite debe ser un número entero')
        .min(1, 'El límite mínimo es 1')
        .max(100, 'El límite máximo es 100')
        .default(20)
};

const validarRangoFechas = (datos) =>
    !datos.fecha_inicio ||
    !datos.fecha_fin ||
    new Date(datos.fecha_fin) > new Date(datos.fecha_inicio);

const validarAlMenosUnCampo = (datos, campoIdentificador = 'id') =>
    Object.keys(datos).some((campo) => campo !== campoIdentificador);

/* Defino los filtros y la paginación para consultar el catálogo de clases. */
export const listarClasesSchema = z.object({
    estado: z.enum(['ACTIVA', 'INACTIVA']).optional(),
    ...paginacionSchema
});

/* Valido los datos necesarios para registrar una clase. */
export const crearClaseSchema = z.object({
    nombre: textoObligatorio(100),
    descripcion: z.string()
        .trim()
        .max(5000, 'La descripción no puede superar los 5000 caracteres')
        .nullable()
        .optional(),
    duracion_minutos: z.coerce.number()
        .int('La duración debe ser un número entero')
        .min(5, 'La duración mínima es de 5 minutos')
        .max(480, 'La duración máxima es de 480 minutos')
        .default(60)
});

/* Permito modificar únicamente los campos admitidos de una clase. */
export const actualizarClaseSchema = z.object({
    id: uuidSchema,
    nombre: textoObligatorio(100).optional(),
    descripcion: z.string()
        .trim()
        .max(5000, 'La descripción no puede superar los 5000 caracteres')
        .nullable()
        .optional(),
    duracion_minutos: z.coerce.number()
        .int('La duración debe ser un número entero')
        .min(5, 'La duración mínima es de 5 minutos')
        .max(480, 'La duración máxima es de 480 minutos')
        .optional(),
    estado: z.enum(['ACTIVA', 'INACTIVA']).optional()
}).refine(
    (datos) => validarAlMenosUnCampo(datos),
    {
        message: 'Debés enviar al menos un campo para actualizar',
        path: ['nombre']
    }
);

export const obtenerClaseSchema = z.object({
    id: uuidSchema
});

/* Valido las fechas y la capacidad al programar una sesión. */
export const crearSesionSchema = z.object({
    clase_id: uuidSchema,
    entrenador_id: uuidSchema,
    fecha_inicio: fechaSchema,
    fecha_fin: fechaSchema,
    cupo: z.coerce.number()
        .int('El cupo debe ser un número entero')
        .min(1, 'El cupo mínimo es de 1 persona')
        .max(500, 'El cupo máximo es de 500 personas')
}).refine(
    validarRangoFechas,
    {
        message: 'La fecha de finalización debe ser posterior al inicio',
        path: ['fecha_fin']
    }
).refine(
    (datos) => new Date(datos.fecha_inicio) > new Date(),
    {
        message: 'La sesión debe programarse en el futuro',
        path: ['fecha_inicio']
    }
);

/* Defino los filtros para consultar las sesiones programadas. */
export const listarSesionesSchema = z.object({
    clase_id: uuidSchema.optional(),
    entrenador_id: uuidSchema.optional(),
    desde: fechaSchema.optional(),
    hasta: fechaSchema.optional(),
    estado: z.enum(['PROGRAMADA', 'CANCELADA', 'FINALIZADA']).optional(),
    ...paginacionSchema
}).refine(
    (datos) =>
        !datos.desde ||
        !datos.hasta ||
        new Date(datos.hasta) >= new Date(datos.desde),
    {
        message: 'La fecha final debe ser posterior o igual a la inicial',
        path: ['hasta']
    }
);

export const obtenerSesionSchema = z.object({
    id: uuidSchema
});

/* Valido las modificaciones permitidas al actualizar una sesión. */
export const actualizarSesionSchema = z.object({
    id: uuidSchema,
    entrenador_id: uuidSchema.optional(),
    fecha_inicio: fechaSchema.optional(),
    fecha_fin: fechaSchema.optional(),
    cupo: z.coerce.number()
        .int('El cupo debe ser un número entero')
        .min(1, 'El cupo mínimo es de 1 persona')
        .max(500, 'El cupo máximo es de 500 personas')
        .optional(),
    estado: z.enum(['PROGRAMADA', 'CANCELADA', 'FINALIZADA']).optional()
}).refine(
    (datos) => validarAlMenosUnCampo(datos),
    {
        message: 'Debés enviar al menos un campo para actualizar',
        path: ['id']
    }
).refine(
    validarRangoFechas,
    {
        message: 'La fecha de finalización debe ser posterior al inicio',
        path: ['fecha_fin']
    }
);

/* Valido los datos para crear una reserva propia o administrativa. */
export const crearReservaSchema = z.object({
    sesion_id: uuidSchema,
    cliente_id: uuidSchema.optional()
});

export const obtenerReservaSchema = z.object({
    id: uuidSchema
});

/* Defino los filtros y la paginación de las reservas. */
export const listarReservasSchema = z.object({
    sesion_id: uuidSchema.optional(),
    cliente_id: uuidSchema.optional(),
    estado: z.enum(['RESERVADA', 'CANCELADA', 'ASISTIO', 'AUSENTE']).optional(),
    ...paginacionSchema
});

/* Limito la actualización de asistencia a los estados correspondientes. */
export const actualizarAsistenciaSchema = z.object({
    id: uuidSchema,
    estado: z.enum(['ASISTIO', 'AUSENTE'])
});