import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';

import clientesServicio from '../services/clientesServicio';
import { useAuth } from '../../../context/AuthContext';

const formularioInicial = {
    nombre: '',
    apellido: '',
    documento: '',
    email: '',
    telefono: '',
    fecha_nacimiento: '',
    direccion: '',
    contacto_emergencia_nombre: '',
    contacto_emergencia_telefono: '',
    observaciones: ''
};

function obtenerFechaMaxima() {
    const fecha = new Date();
    fecha.setFullYear(fecha.getFullYear() - 14);

    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, '0'),
        String(fecha.getDate()).padStart(2, '0')
    ].join('-');
}

const fechaMaximaNacimiento = obtenerFechaMaxima();

function ClienteNuevoPage() {
    const navegar = useNavigate();
    const { csrfToken, usuario } = useAuth();

    const puedeCrear = usuario?.permisos?.includes('clientes.crear') ?? false;

    const [formulario, setFormulario] = useState(formularioInicial);
    const [erroresCampos, setErroresCampos] = useState({});
    const [guardando, setGuardando] = useState(false);
    const [errorGeneral, setErrorGeneral] = useState('');

    function manejarCambio(evento) {
        const { name, value } = evento.target;

        const camposNumericos = [
            'documento',
            'telefono',
            'contacto_emergencia_telefono'
        ];

        const valorFinal = camposNumericos.includes(name)
            ? value.replace(/\D/g, '')
            : value;

        setFormulario((actual) => ({
            ...actual,
            [name]: valorFinal
        }));

        setErroresCampos((actual) => ({
            ...actual,
            [name]: undefined
        }));

        setErrorGeneral('');
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();

        if (!puedeCrear || guardando) return;

        setErroresCampos({});
        setErrorGeneral('');

        if (!formulario.nombre.trim() || !formulario.apellido.trim()) {
            setErroresCampos({
                nombre: !formulario.nombre.trim()
                    ? ['El nombre es obligatorio']
                    : undefined,
                apellido: !formulario.apellido.trim()
                    ? ['El apellido es obligatorio']
                    : undefined
            });
            return;
        }

        if (
            formulario.fecha_nacimiento &&
            formulario.fecha_nacimiento > fechaMaximaNacimiento
        ) {
            setErroresCampos({
                fecha_nacimiento: ['El cliente debe tener al menos 14 años']
            });
            return;
        }

        try {
            setGuardando(true);

            const datos = Object.fromEntries(
                Object.entries(formulario).map(([clave, valor]) => [
                    clave,
                    valor.trim() || null
                ])
            );

            const respuesta = await clientesServicio.crear(datos, csrfToken);

            navegar(`/clientes/${respuesta.data.id}`);
        } catch (error) {
            const respuesta = error.response?.data;

            if (respuesta?.errors) {
                setErroresCampos(respuesta.errors);
            } else {
                setErrorGeneral(
                    respuesta?.message ||
                    'No se pudo registrar el cliente. Intentá nuevamente.'
                );
            }
        } finally {
            setGuardando(false);
        }
    }

    function campo(etiqueta, nombre, opciones = {}) {
        const {
            tipo = 'text',
            requerido = false,
            anchoCompleto = false,
            max
        } = opciones;

        const errorCampo = erroresCampos[nombre];

        return (
            <div className={anchoCompleto ? 'md:col-span-2' : ''}>
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
                    max={max}
                    inputMode={
                        ['documento', 'telefono', 'contacto_emergencia_telefono'].includes(nombre)
                            ? 'numeric'
                            : undefined
                    }
                    className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                        errorCampo
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                />

                {errorCampo && (
                    <p className="mt-1 text-sm text-red-600">
                        {Array.isArray(errorCampo)
                            ? errorCampo[0]
                            : errorCampo}
                    </p>
                )}
            </div>
        );
    }

    if (!puedeCrear) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-800">
                    No tenés permiso para crear clientes.
                </p>

                <button
                    type="button"
                    onClick={() => navegar('/clientes')}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Volver a clientes
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navegar('/clientes')}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                    aria-label="Volver a clientes"
                >
                    <ArrowLeft size={20} />
                </button>

                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Nuevo cliente
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Completá los datos para registrar un cliente.
                    </p>
                </div>
            </div>

            <form onSubmit={manejarEnvio} className="space-y-6">
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-800">
                        Información personal
                    </h2>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {campo('Nombre', 'nombre', { requerido: true })}
                        {campo('Apellido', 'apellido', { requerido: true })}
                        {campo('Documento', 'documento')}
                        {campo('Fecha de nacimiento', 'fecha_nacimiento', {
                            tipo: 'date',
                            max: fechaMaximaNacimiento
                        })}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-800">
                        Información de contacto
                    </h2>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {campo('Correo electrónico', 'email', {
                            tipo: 'email'
                        })}
                        {campo('Teléfono', 'telefono')}
                        {campo('Dirección', 'direccion', {
                            anchoCompleto: true
                        })}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-800">
                        Contacto de emergencia
                    </h2>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {campo('Nombre del contacto', 'contacto_emergencia_nombre')}
                        {campo('Teléfono del contacto', 'contacto_emergencia_telefono')}
                    </div>
                </section>

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="mb-5 text-lg font-semibold text-slate-800">
                        Observaciones
                    </h2>

                    <textarea
                        id="observaciones"
                        name="observaciones"
                        value={formulario.observaciones}
                        onChange={manejarCambio}
                        rows={4}
                        maxLength={5000}
                        placeholder="Información adicional sobre el cliente..."
                        className={`w-full resize-y rounded-lg border px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                            erroresCampos.observaciones
                                ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                                : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                        }`}
                    />

                    {erroresCampos.observaciones && (
                        <p className="mt-1 text-sm text-red-600">
                            {erroresCampos.observaciones[0]}
                        </p>
                    )}
                </section>

                {errorGeneral && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorGeneral}
                    </div>
                )}

                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navegar('/clientes')}
                        disabled={guardando}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        disabled={guardando}
                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Save size={17} />
                        {guardando ? 'Guardando...' : 'Guardar cliente'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default ClienteNuevoPage;