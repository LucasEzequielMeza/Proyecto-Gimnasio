import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Pencil,
    UserRound,
    Mail,
    Phone,
    MapPin,
    CalendarDays,
    FileText,
    ShieldCheck,
    AlertCircle
} from 'lucide-react';

import clientesServicio from '../services/clientesServicio';
import { useAuth } from '../../../context/AuthContext';

function formatearFecha(fecha) {
    if (!fecha) return 'No especificada';

    const fechaLocal = String(fecha).slice(0, 10);
    const [anio, mes, dia] = fechaLocal.split('-');

    return `${dia}/${mes}/${anio}`;
}

function calcularEdad(fechaNacimiento) {
    if (!fechaNacimiento) return null;

    const fecha = new Date(`${String(fechaNacimiento).slice(0, 10)}T00:00:00`);
    const hoy = new Date();

    let edad = hoy.getFullYear() - fecha.getFullYear();

    const aunNoCumplio =
        hoy.getMonth() < fecha.getMonth() ||
        (
            hoy.getMonth() === fecha.getMonth() &&
            hoy.getDate() < fecha.getDate()
        );

    if (aunNoCumplio) edad--;

    return edad;
}

function CampoDetalle({ etiqueta, valor, icono: Icono }) {
    return (
        <div className="flex gap-3">
            {Icono && (
                <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-500">
                    <Icono size={17} />
                </div>
            )}

            <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {etiqueta}
                </p>

                <p className="mt-1 break-words text-sm font-medium text-slate-800">
                    {valor || 'No especificado'}
                </p>
            </div>
        </div>
    );
}

function SeccionDetalle({ titulo, children }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-6 text-lg font-semibold text-slate-800">
                {titulo}
            </h2>

            {children}
        </section>
    );
}

function ClienteDetallePage() {
    const { id } = useParams();
    const navegar = useNavigate();
    const { usuario } = useAuth();

    const permisos = usuario?.permisos ?? [];

    const puedeConsultar = permisos.includes('clientes.consultar');
    const puedeEditar = permisos.includes('clientes.editar');

    const [cliente, setCliente] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const cargarCliente = useCallback(async () => {
        if (!puedeConsultar) {
            setCargando(false);
            return;
        }

        try {
            setCargando(true);
            setError('');

            const respuesta = await clientesServicio.obtener(id);
            setCliente(respuesta.data);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                error.response?.data?.mensaje ||
                'No se pudo cargar la información del cliente.'
            );
        } finally {
            setCargando(false);
        }
    }, [id, puedeConsultar]);

    useEffect(() => {
        cargarCliente();
    }, [cargarCliente]);

    if (!puedeConsultar) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-800">
                    No tenés permiso para consultar clientes.
                </p>

                <button
                    type="button"
                    onClick={() => navegar('/')}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    if (cargando) {
        return (
            <div className="py-16 text-center text-sm text-slate-500">
                Cargando información del cliente...
            </div>
        );
    }

    if (error || !cliente) {
        return (
            <div className="mx-auto max-w-5xl space-y-4">
                <button
                    type="button"
                    onClick={() => navegar('/clientes')}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-blue-600"
                >
                    <ArrowLeft size={18} />
                    Volver a clientes
                </button>

                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5">
                    <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={20} />

                    <div>
                        <p className="font-semibold text-red-800">
                            No se pudo mostrar el cliente
                        </p>

                        <p className="mt-1 text-sm text-red-700">
                            {error || 'Cliente no encontrado.'}
                        </p>

                        <button
                            type="button"
                            onClick={cargarCliente}
                            className="mt-3 text-sm font-semibold text-red-700 underline"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const nombreCompleto = `${cliente.nombre} ${cliente.apellido}`;
    const edad = calcularEdad(cliente.fecha_nacimiento);

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
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
                        <h1 className="text-2xl font-bold text-slate-900">
                            Detalle del cliente
                        </h1>

                        <p className="mt-1 text-sm text-slate-500">
                            Información y datos personales.
                        </p>
                    </div>
                </div>

                {puedeEditar && (
                    <button
                        type="button"
                        onClick={() => navegar(`/clientes/${id}/editar`)}
                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        <Pencil size={17} />
                        Editar cliente
                    </button>
                )}
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                            <UserRound size={30} />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-slate-900">
                                {nombreCompleto}
                            </h2>

                            <p className="mt-1 text-sm text-slate-500">
                                Cliente registrado
                            </p>
                        </div>
                    </div>

                    <span
                        className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
                            cliente.estado === 'activo'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                        <span className={`h-2 w-2 rounded-full ${
                            cliente.estado === 'activo'
                                ? 'bg-emerald-500'
                                : 'bg-slate-400'
                        }`} />

                        {cliente.estado === 'activo' ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
            </section>

            <SeccionDetalle titulo="Información personal">
                <div className="grid gap-6 sm:grid-cols-2">
                    <CampoDetalle etiqueta="Nombre" valor={cliente.nombre} icono={UserRound} />
                    <CampoDetalle etiqueta="Apellido" valor={cliente.apellido} icono={UserRound} />
                    <CampoDetalle etiqueta="Documento" valor={cliente.documento} icono={FileText} />

                    <CampoDetalle
                        etiqueta="Fecha de nacimiento"
                        valor={
                            cliente.fecha_nacimiento
                                ? `${formatearFecha(cliente.fecha_nacimiento)}${edad !== null ? ` (${edad} años)` : ''}`
                                : null
                        }
                        icono={CalendarDays}
                    />
                </div>
            </SeccionDetalle>

            <SeccionDetalle titulo="Información de contacto">
                <div className="grid gap-6 sm:grid-cols-2">
                    <CampoDetalle etiqueta="Correo electrónico" valor={cliente.email} icono={Mail} />
                    <CampoDetalle etiqueta="Teléfono" valor={cliente.telefono} icono={Phone} />

                    <div className="sm:col-span-2">
                        <CampoDetalle etiqueta="Dirección" valor={cliente.direccion} icono={MapPin} />
                    </div>
                </div>
            </SeccionDetalle>

            <SeccionDetalle titulo="Contacto de emergencia">
                <div className="grid gap-6 sm:grid-cols-2">
                    <CampoDetalle
                        etiqueta="Nombre del contacto"
                        valor={cliente.contacto_emergencia_nombre}
                        icono={UserRound}
                    />

                    <CampoDetalle
                        etiqueta="Teléfono del contacto"
                        valor={cliente.contacto_emergencia_telefono}
                        icono={Phone}
                    />
                </div>
            </SeccionDetalle>

            <SeccionDetalle titulo="Observaciones">
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {cliente.observaciones || 'No hay observaciones registradas.'}
                </p>
            </SeccionDetalle>

            <SeccionDetalle titulo="Información del registro">
                <div className="grid gap-6 sm:grid-cols-2">
                    <CampoDetalle
                        etiqueta="Fecha de alta"
                        valor={formatearFecha(cliente.creado_at)}
                        icono={CalendarDays}
                    />

                    <CampoDetalle
                        etiqueta="Última actualización"
                        valor={formatearFecha(cliente.actualizado_at)}
                        icono={ShieldCheck}
                    />
                </div>
            </SeccionDetalle>
        </div>
    );
}

export default ClienteDetallePage;