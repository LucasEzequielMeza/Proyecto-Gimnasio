import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    RefreshCw,
    Pencil,
    Power,
    X,
    AlertTriangle
} from 'lucide-react';

import planesServicio from '../services/planesServicio';
import { useAuth } from '../../../context/AuthContext';

function PlanesPage() {
    const navegar = useNavigate();
    const location = useLocation();
    const { csrfToken } = useAuth();

    const [planes, setPlanes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [estado, setEstado] = useState('');
    const [tipo, setTipo] = useState('');
    const [pagina, setPagina] = useState(1);
    const [planSeleccionado, setPlanSeleccionado] = useState(null);
    const [cambiandoEstado, setCambiandoEstado] = useState(false);

    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        limite: 10,
        total: 0,
        totalPaginas: 0
    });

    const obtenerPlanes = useCallback(async () => {
        try {
            setCargando(true);
            setError('');

            const respuesta = await planesServicio.listar({
                pagina,
                limite: 10,
                busqueda: busquedaAplicada,
                ...(estado && { estado }),
                ...(tipo && { tipo })
            });

            setPlanes(respuesta.data || []);
            setPaginacion(respuesta.paginacion);
        } catch (error) {
            setError(
                error.response?.data?.message ||
                'No se pudieron obtener los planes.'
            );
        } finally {
            setCargando(false);
        }
    }, [pagina, busquedaAplicada, estado, tipo]);

    useEffect(() => {
        obtenerPlanes();
    }, [obtenerPlanes]);

    useEffect(() => {
        if (location.state?.mensaje) {
            setMensajeExito(location.state.mensaje);

            navegar(location.pathname, {
                replace: true,
                state: {}
            });
        }
    }, [location, navegar]);

    useEffect(() => {
        if (!mensajeExito) return undefined;

        const temporizador = setTimeout(() => {
            setMensajeExito('');
        }, 4000);

        return () => clearTimeout(temporizador);
    }, [mensajeExito]);

    function buscar(evento) {
        evento.preventDefault();
        setPagina(1);
        setBusquedaAplicada(busqueda.trim());
    }

    function formatearPrecio(precio, moneda = 'ARS') {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: moneda,
            maximumFractionDigits: 0
        }).format(Number(precio));
    }

    function abrirConfirmacion(plan) {
        setError('');
        setPlanSeleccionado(plan);
    }

    function cerrarConfirmacion() {
        if (cambiandoEstado) return;

        setPlanSeleccionado(null);
    }

    async function confirmarCambioEstado() {
        if (!planSeleccionado || cambiandoEstado) return;

        const nuevoEstado =
            planSeleccionado.estado === 'activo' ? 'inactivo' : 'activo';

        try {
            setCambiandoEstado(true);
            setError('');

            await planesServicio.cambiarEstado(
                planSeleccionado.id,
                nuevoEstado,
                csrfToken
            );

            setPlanSeleccionado(null);
            setMensajeExito(
                nuevoEstado === 'activo'
                    ? 'El plan se activó correctamente.'
                    : 'El plan se desactivó correctamente.'
            );

            await obtenerPlanes();
        } catch (error) {
            setError(
                error.response?.data?.message ||
                'No se pudo modificar el estado del plan.'
            );
        } finally {
            setCambiandoEstado(false);
        }
    }

    const accionActivacion = planSeleccionado?.estado === 'inactivo';
    const accion = accionActivacion ? 'activar' : 'desactivar';

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            Planes
                        </h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Administrá los planes y sus condiciones.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => navegar('/planes/nuevo')}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
                    >
                        <Plus size={18} />
                        Nuevo plan
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-500">
                            Planes encontrados
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-800">
                            {paginacion.total}
                        </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-500">
                            Página actual
                        </p>
                        <p className="mt-2 text-2xl font-bold text-slate-800">
                            {paginacion.pagina} de {paginacion.totalPaginas}
                        </p>
                    </div>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <form
                        onSubmit={buscar}
                        className="grid grid-cols-1 gap-3 md:grid-cols-4"
                    >
                        <div className="relative md:col-span-2">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="text"
                                value={busqueda}
                                onChange={(evento) =>
                                    setBusqueda(evento.target.value)
                                }
                                placeholder="Buscar por nombre o descripción..."
                                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        <select
                            value={tipo}
                            onChange={(evento) => {
                                setTipo(evento.target.value);
                                setPagina(1);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="">Todos los tipos</option>
                            <option value="FIJO">Fijo</option>
                            <option value="MENSUAL">Mensual</option>
                        </select>

                        <select
                            value={estado}
                            onChange={(evento) => {
                                setEstado(evento.target.value);
                                setPagina(1);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="">Todos los estados</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>

                        <div className="flex flex-wrap gap-2 md:col-span-4 md:justify-end">
                            <button
                                type="submit"
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
                            >
                                <Search size={16} />
                                Buscar
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setBusqueda('');
                                    setBusquedaAplicada('');
                                    setEstado('');
                                    setTipo('');
                                    setPagina(1);
                                }}
                                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Limpiar filtros
                            </button>

                            <button
                                type="button"
                                onClick={obtenerPlanes}
                                disabled={cargando}
                                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                <RefreshCw
                                    size={16}
                                    className={cargando ? 'animate-spin' : ''}
                                />
                                Actualizar
                            </button>
                        </div>
                    </form>
                </section>

                {mensajeExito && (
                    <div
                        role="status"
                        className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                    >
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                            ✓
                        </div>
                        <p>{mensajeExito}</p>
                        <button
                            type="button"
                            onClick={() => setMensajeExito('')}
                            className="ml-auto text-green-700 hover:text-green-900"
                            aria-label="Cerrar mensaje"
                        >
                            <X size={17} />
                        </button>
                    </div>
                )}

                {error && (
                    <div
                        role="alert"
                        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    >
                        {error}
                    </div>
                )}

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {cargando ? (
                        <div className="py-12 text-center text-sm text-slate-500">
                            Cargando planes...
                        </div>
                    ) : planes.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="font-medium text-slate-700">
                                No se encontraron planes
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                                Probá modificando los filtros o creando un nuevo plan.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Plan</th>
                                        <th className="px-5 py-4">Tipo</th>
                                        <th className="px-5 py-4">Duración</th>
                                        <th className="px-5 py-4">Precio</th>
                                        <th className="px-5 py-4">Estado</th>
                                        <th className="px-5 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100">
                                    {planes.map((plan) => (
                                        <tr
                                            key={plan.id}
                                            className="transition hover:bg-slate-50"
                                        >
                                            <td className="px-5 py-4">
                                                <p className="font-medium text-slate-800">
                                                    {plan.nombre}
                                                </p>
                                                <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                                                    {plan.descripcion || 'Sin descripción'}
                                                </p>
                                            </td>

                                            <td className="px-5 py-4">
                                                {plan.tipo === 'FIJO' ? 'Fijo' : 'Mensual'}
                                            </td>

                                            <td className="px-5 py-4">
                                                {plan.tipo === 'MENSUAL'
                                                    ? 'Mensual'
                                                    : `${plan.duracion_dias} días`}
                                            </td>

                                            <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                                                {formatearPrecio(plan.precio, 'ARS')}
                                            </td>

                                            <td className="px-5 py-4">
                                                <span
                                                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                                        plan.estado === 'activo'
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    {plan.estado === 'activo' ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        title="Editar plan"
                                                        aria-label={`Editar ${plan.nombre}`}
                                                        onClick={() =>
                                                            navegar(`/planes/${plan.id}/editar`)
                                                        }
                                                        className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>

                                                    <button
                                                        type="button"
                                                        title={
                                                            plan.estado === 'activo'
                                                                ? 'Desactivar plan'
                                                                : 'Activar plan'
                                                        }
                                                        aria-label={
                                                            plan.estado === 'activo'
                                                                ? `Desactivar ${plan.nombre}`
                                                                : `Activar ${plan.nombre}`
                                                        }
                                                        onClick={() => abrirConfirmacion(plan)}
                                                        className={`rounded-lg p-2 transition ${
                                                            plan.estado === 'activo'
                                                                ? 'text-red-600 hover:bg-red-50'
                                                                : 'text-green-600 hover:bg-green-50'
                                                        }`}
                                                    >
                                                        <Power size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {!cargando && paginacion.totalPaginas > 1 && (
                        <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500">
                                Mostrando página {paginacion.pagina} de {paginacion.totalPaginas}
                            </p>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={pagina <= 1}
                                    onClick={() => setPagina((actual) => actual - 1)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Anterior
                                </button>

                                <button
                                    type="button"
                                    disabled={pagina >= paginacion.totalPaginas}
                                    onClick={() => setPagina((actual) => actual + 1)}
                                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {planSeleccionado && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget) {
                            cerrarConfirmacion();
                        }
                    }}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirmacion-titulo"
                        aria-describedby="confirmacion-descripcion"
                        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <div
                                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                        accionActivacion
                                            ? 'bg-green-50 text-green-600'
                                            : 'bg-amber-50 text-amber-600'
                                    }`}
                                >
                                    {accionActivacion
                                        ? <Power size={21} />
                                        : <AlertTriangle size={21} />}
                                </div>

                                <div>
                                    <h2
                                        id="confirmacion-titulo"
                                        className="text-lg font-semibold text-slate-900"
                                    >
                                        {accionActivacion ? 'Activar plan' : 'Desactivar plan'}
                                    </h2>
                                    <p className="mt-1 text-sm text-slate-500">
                                        Confirmá esta operación para continuar.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarConfirmacion}
                                disabled={cambiandoEstado}
                                aria-label="Cerrar"
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                            >
                                <X size={19} />
                            </button>
                        </div>

                        <div className="px-6 py-5">
                            <p
                                id="confirmacion-descripcion"
                                className="text-sm leading-6 text-slate-600"
                            >
                                ¿Estás seguro de que querés {accion} el plan{' '}
                                <span className="font-semibold text-slate-900">
                                    {planSeleccionado.nombre}
                                </span>
                                ?
                            </p>

                            {!accionActivacion && (
                                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    Al desactivar este plan, dejará de estar disponible
                                    para nuevas contrataciones. No se elimina su información.
                                </div>
                            )}

                            {accionActivacion && (
                                <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                                    El plan volverá a estar disponible para nuevas contrataciones.
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={cerrarConfirmacion}
                                disabled={cambiandoEstado}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={confirmarCambioEstado}
                                disabled={cambiandoEstado}
                                className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    accionActivacion
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                }`}
                            >
                                <Power size={16} />
                                {cambiandoEstado
                                    ? 'Procesando...'
                                    : accionActivacion
                                        ? 'Sí, activar plan'
                                        : 'Sí, desactivar plan'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default PlanesPage;