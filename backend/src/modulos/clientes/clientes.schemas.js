import { z } from 'zod';

const textoOpcional = (maximo) => z.preprocess(
    (valor) => valor === '' ? null : valor,
    z.string()
        .trim()
        .max(maximo, `No puede superar los ${maximo} caracteres`)
        .nullable()
        .optional()
);

const emailOpcional = z.preprocess(
    (valor) => valor === '' ? null : valor,
    z.string()
        .trim()
        .email('El email no tiene un formato válido')
        .max(254, 'El email no puede superar los 254 caracteres')
        .nullable()
        .optional()
);

const usuarioIdOpcional = z.preprocess(
    (valor) => valor === '' ? null : valor,
    z.string()
        .uuid('El ID del usuario no tiene un formato válido')
        .nullable()
        .optional()
);

const esFechaReal = (valor) => {
    const coincidencia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);

    if (!coincidencia) {
        return false;
    }

    const anio = Number(coincidencia[1]);
    const mes = Number(coincidencia[2]);
    const dia = Number(coincidencia[3]);

    const fecha = new Date(0);
    fecha.setUTCHours(0, 0, 0, 0);
    fecha.setUTCFullYear(anio, mes - 1, dia);

    return (
        fecha.getUTCFullYear() === anio &&
        fecha.getUTCMonth() === mes - 1 &&
        fecha.getUTCDate() === dia
    );
};

const fechaOpcional = z.preprocess(
    (valor) => valor === '' ? null : valor,
    z.string()
        .refine(
            esFechaReal,
            'La fecha debe ser válida y tener formato YYYY-MM-DD'
        )
        .nullable()
        .optional()
);

export const listarClientesSchema = z.object({
    pagina: z.coerce.number({
        error: 'La página debe ser un número'
    }).int('La página debe ser un número entero')
        .min(1, 'La página debe ser mayor que cero')
        .default(1),

    limite: z.coerce.number({
        error: 'El límite debe ser un número'
    }).int('El límite debe ser un número entero')
        .min(1, 'El límite mínimo es 1')
        .max(100, 'El límite máximo es 100')
        .default(20),

    buscar: z.string()
        .trim()
        .max(100, 'La búsqueda no puede superar los 100 caracteres')
        .default(''),

    estado: z.enum(['activo', 'inactivo'], {
        error: 'El estado debe ser activo o inactivo'
    }).optional()
}).strict();

export const idClienteSchema = z.object({
    id: z.string().uuid('El ID del cliente no tiene un formato válido')
}).strict();

export const crearClienteSchema = z.object({
    usuario_id: usuarioIdOpcional,

    nombre: z.string()
        .trim()
        .min(1, 'El nombre es obligatorio')
        .max(100, 'El nombre no puede superar los 100 caracteres'),

    apellido: z.string()
        .trim()
        .min(1, 'El apellido es obligatorio')
        .max(100, 'El apellido no puede superar los 100 caracteres'),

    documento: textoOpcional(30),
    email: emailOpcional,
    telefono: textoOpcional(30),

    fecha_nacimiento: fechaOpcional,
    direccion: textoOpcional(250),

    contacto_emergencia_nombre: textoOpcional(150),
    contacto_emergencia_telefono: textoOpcional(30),

    observaciones: z.preprocess(
        (valor) => valor === '' ? null : valor,
        z.string()
            .trim()
            .max(5000, 'Las observaciones no pueden superar los 5000 caracteres')
            .nullable()
            .optional()
    )
}).strict();

export const editarClienteSchema = crearClienteSchema
    .partial()
    .refine(
        (datos) => Object.keys(datos).length > 0,
        'Debés enviar al menos un campo para actualizar'
    );

export const cambiarEstadoClienteSchema = z.object({
    estado: z.enum(['activo', 'inactivo'], {
        error: 'El estado debe ser activo o inactivo'
    })
}).strict();