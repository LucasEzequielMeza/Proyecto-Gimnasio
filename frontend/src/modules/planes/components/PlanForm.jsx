import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';

const formularioInicial = {
    nombre: '',
    descripcion: '',
    precio: '',
    tipo: 'FIJO',
    duracion_dias: ''
};

function PlanForm({
    valoresIniciales,
    onSubmit,
    guardando,
    textoBoton,
    modoEdicion = false
}) {
    const [formulario, setFormulario] = useState(formularioInicial);
    const [erroresCampos, setErroresCampos] = useState({});
    const [errorGeneral, setErrorGeneral] = useState('');

    useEffect(() => {
        if (valoresIniciales) {
            setFormulario({
                nombre: valoresIniciales.nombre ?? '',
                descripcion: valoresIniciales.descripcion ?? '',
                precio: valoresIniciales.precio ?? '',
                tipo: valoresIniciales.tipo ?? 'FIJO',
                duracion_dias: valoresIniciales.duracion_dias ?? ''
            });
        }
    }, [valoresIniciales]);

    function manejarCambio(evento) {
        const { name, value } = evento.target;

        setFormulario((actual) => ({
            ...actual,
            [name]: value
        }));

        setErroresCampos((actual) => ({
            ...actual,
            [name]: undefined
        }));

        setErrorGeneral('');
    }

    function obtenerMensajeError(campo) {
        const error = erroresCampos[campo];

        if (!error) return null;

        return Array.isArray(error) ? error[0] : error;
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();

        setErroresCampos({});
        setErrorGeneral('');

        const errores = {};
        const precio = Number(formulario.precio);

        if (!formulario.nombre.trim()) {
            errores.nombre = ['El nombre del plan es obligatorio'];
        } else if (formulario.nombre.trim().length > 100) {
            errores.nombre = ['El nombre no puede superar los 100 caracteres'];
        }

        if (
            formulario.precio === '' ||
            !Number.isFinite(precio)
        ) {
            errores.precio = ['Ingresá un precio válido'];
        } else if (precio < 500) {
            errores.precio = ['El precio mínimo permitido es $500'];
        } else if (precio > 9999999500) {
            errores.precio = ['El precio supera el máximo permitido'];
        } else if (!Number.isInteger(precio / 500)) {
            errores.precio = ['El precio debe aumentar en incrementos de $500'];
        }

        if (formulario.descripcion.length > 2000) {
            errores.descripcion = [
                'La descripción no puede superar los 2000 caracteres'
            ];
        }

        if (
            formulario.tipo === 'FIJO' &&
            (
                formulario.duracion_dias === '' ||
                !Number.isInteger(Number(formulario.duracion_dias)) ||
                Number(formulario.duracion_dias) <= 0 ||
                Number(formulario.duracion_dias) > 36500
            )
        ) {
            errores.duracion_dias = [
                'La duración debe ser un número entero entre 1 y 36500'
            ];
        }

        if (Object.keys(errores).length > 0) {
            setErroresCampos(errores);
            return;
        }

        const datos = {
            nombre: formulario.nombre.trim(),
            descripcion: formulario.descripcion.trim() || null,
            precio,
            tipo: formulario.tipo
        };

        if (formulario.tipo === 'FIJO') {
            datos.duracion_dias = Number(formulario.duracion_dias);
        } else if (modoEdicion) {
            datos.duracion_dias = null;
        }

        try {
            await onSubmit(datos);
        } catch (error) {
            const respuesta = error.response?.data;

            if (respuesta?.errores && Array.isArray(respuesta.errores)) {
                const erroresServidor = {};

                respuesta.errores.forEach((item) => {
                    erroresServidor[item.campo] = [
                        ...(erroresServidor[item.campo] || []),
                        item.mensaje
                    ];
                });

                setErroresCampos(erroresServidor);
            } else if (respuesta?.errors) {
                setErroresCampos(respuesta.errors);
            } else {
                setErrorGeneral(
                    respuesta?.message ||
                    'No se pudieron guardar los datos del plan.'
                );
            }
        }
    }

    function campo(etiqueta, nombre, opciones = {}) {
        const {
            tipo = 'text',
            requerido = false,
            placeholder = '',
            min,
            max,
            step
        } = opciones;

        const mensajeError = obtenerMensajeError(nombre);

        return (
            <div>
                <label
                    htmlFor={nombre}
                    className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                    {etiqueta}
                    {requerido && (
                        <span className="ml-1 text-red-500">*</span>
                    )}
                </label>

                <input
                    id={nombre}
                    name={nombre}
                    type={tipo}
                    value={formulario[nombre]}
                    onChange={manejarCambio}
                    required={requerido}
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    step={step}
                    aria-invalid={Boolean(mensajeError)}
                    aria-describedby={mensajeError ? `${nombre}-error` : undefined}
                    className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                        mensajeError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                />

                {mensajeError && (
                    <p
                        id={`${nombre}-error`}
                        className="mt-1 text-sm text-red-600"
                    >
                        {mensajeError}
                    </p>
                )}
            </div>
        );
    }

    return (
        <form onSubmit={manejarEnvio} className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-lg font-semibold text-slate-800">
                    Información del plan
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="md:col-span-2">
                        {campo('Nombre', 'nombre', {
                            requerido: true,
                            placeholder: 'Ej. Plan musculación'
                        })}
                    </div>

                    <div className="md:col-span-2">
                        <label
                            htmlFor="descripcion"
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                            Descripción
                        </label>

                        <textarea
                            id="descripcion"
                            name="descripcion"
                            value={formulario.descripcion}
                            onChange={manejarCambio}
                            rows={4}
                            maxLength={2000}
                            placeholder="Descripción de los beneficios y condiciones del plan..."
                            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        {obtenerMensajeError('descripcion') && (
                            <p className="mt-1 text-sm text-red-600">
                                {obtenerMensajeError('descripcion')}
                            </p>
                        )}
                    </div>

                    <div>
                        {campo('Precio mensual o del plan', 'precio', {
                            tipo: 'number',
                            requerido: true,
                            min: 500,
                            max: 9999999500,
                            step: 500,
                            placeholder: '500'
                        })}

                        <p className="mt-1.5 text-xs text-slate-500">
                            El precio mínimo es $500 y solo se permiten
                            incrementos de $500.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="moneda"
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                            Moneda
                        </label>

                        <div className="flex min-h-[42px] items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <span className="text-sm font-medium text-slate-700">
                                ARS — Peso argentino
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                <Info size={14} />
                                Fija
                            </span>
                        </div>

                        <p className="mt-1.5 text-xs text-slate-500">
                            La moneda del sistema está establecida en pesos argentinos.
                        </p>
                    </div>

                    <div>
                        <label
                            htmlFor="tipo"
                            className="mb-1.5 block text-sm font-medium text-slate-700"
                        >
                            Tipo de plan
                            <span className="ml-1 text-red-500">*</span>
                        </label>

                        <select
                            id="tipo"
                            name="tipo"
                            value={formulario.tipo}
                            onChange={(evento) => {
                                manejarCambio(evento);

                                if (evento.target.value === 'MENSUAL') {
                                    setFormulario((actual) => ({
                                        ...actual,
                                        tipo: 'MENSUAL',
                                        duracion_dias: ''
                                    }));

                                    setErroresCampos((actual) => ({
                                        ...actual,
                                        duracion_dias: undefined
                                    }));
                                }
                            }}
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        >
                            <option value="FIJO">Fijo</option>
                            <option value="MENSUAL">Mensual</option>
                        </select>
                    </div>

                    {formulario.tipo === 'FIJO' && (
                        campo('Duración en días', 'duracion_dias', {
                            tipo: 'number',
                            requerido: true,
                            min: 1,
                            max: 36500,
                            step: 1,
                            placeholder: 'Ej. 30'
                        })
                    )}

                    {formulario.tipo === 'MENSUAL' && (
                        <div className="flex items-center rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
                            Los planes mensuales no requieren una duración en días.
                        </div>
                    )}
                </div>
            </section>

            {errorGeneral && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {errorGeneral}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={guardando}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save size={17} />
                    {guardando ? 'Guardando...' : textoBoton}
                </button>
            </div>
        </form>
    );
}

export default PlanForm;