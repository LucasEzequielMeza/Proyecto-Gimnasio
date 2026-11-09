import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CalendarCheck,
    Plus,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    X,
    Users
} from 'lucide-react';

import TablaAsistencias from '../components/TablaAsistencias';
import RegistrarAsistenciaModal from '../components/RegistrarAsistenciaModal';

import asistenciasServicio from '../services/asistenciasServicio';
import clientesServicio from '../../clientes/services/clientesServicio';

import { useAuth } from '../../../context/AuthContext';

function AsistenciasPage() {
    const navigate = useNavigate();
    const { usuario, csrfToken } = useAuth();

    const permisos = usuario?.permisos ?? [];

    const puedeConsultar = permisos.includes('asistencias.consultar');
    const puedeRegistrar = permisos.includes('asistencias.registrar');

    const [asistencias, setAsistencias] = useState([]);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');

    const [busquedaCliente, setBusquedaCliente] = useState('');
    const [clientesEncontrados, setClientesEncontrados] = useState([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [buscandoClientes, setBuscandoClientes] = useState(false);

    const [pagina, setPagina] = useState(1);

    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0
    });

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [errorRegistro, setErrorRegistro] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    const cargarAsistencias = useCallback(async () => {
        if (!puedeConsultar) {
            setCargando(false);
            return;
        }

        setCargando(true);
        setError('');

        try {
            const respuesta = await asistenciasServicio.listar({
                pagina,
                limite: 20,
                ...(clienteSeleccionado && {
                    cliente_id: clienteSeleccionado.id
                }),
                ...(fechaDesde && { fecha_desde: fechaDesde }),
                ...(fechaHasta && { fecha_hasta: fechaHasta })
            });

            setAsistencias(respuesta.asistencias ?? []);
            setPaginacion(respuesta.paginacion ?? {
                pagina: 1,
                limite: 20,
                total: 0,
                totalPaginas: 0
            });
        } catch (error) {
            setAsistencias([]);
            setError(
                error.response?.data?.mensaje ||
                error.response?.data?.message ||
                'No se pudieron cargar las asistencias.'
            );
        } finally {
            setCargando(false);
        }
    }, [
        puedeConsultar,
        pagina,
        clienteSeleccionado,
        fechaDesde,
        fechaHasta
    ]);

    useEffect(() => {
        if (!puedeConsultar) {
            setCargando(false);
            return undefined;
        }

        const temporizador = setTimeout(() => {
            cargarAsistencias();
        }, 250);

        return () => clearTimeout(temporizador);
    }, [cargarAsistencias, puedeConsultar]);

    useEffect(() => {
        const termino = busquedaCliente.trim();

        if (clienteSeleccionado || termino.length < 2) {
            setClientesEncontrados([]);
            setBuscandoClientes(false);
            return undefined;
        }

        const temporizador = setTimeout(async () => {
            setBuscandoClientes(true);

            try {
                const respuesta = await clientesServicio.listar({
                    pagina: 1,
                    limite: 8,
                    buscar: termino,
                    estado: 'activo'
                });

                setClientesEncontrados(respuesta.data ?? []);
            } catch {
                setClientesEncontrados([]);
            } finally {
                setBuscandoClientes(false);
            }
        }, 300);

        return () => clearTimeout(temporizador);
    }, [busquedaCliente, clienteSeleccionado]);

    const seleccionarCliente = (cliente) => {
        setClienteSeleccionado(cliente);
        setBusquedaCliente(`${cliente.nombre} ${cliente.apellido}`);
        setClientesEncontrados([]);
        setPagina(1);
    };

    const limpiarCliente = () => {
        setClienteSeleccionado(null);
        setBusquedaCliente('');
        setClientesEncontrados([]);
        setPagina(1);
    };

    const limpiarFiltros = () => {
        setFechaDesde('');
        setFechaHasta('');
        limpiarCliente();
        setPagina(1);
    };

    const manejarRegistro = async (datos) => {
        if (!puedeRegistrar || guardando) return;

        setGuardando(true);
        setErrorRegistro('');

        try {
            await asistenciasServicio.registrar(datos, csrfToken);

            setModalAbierto(false);
            setErrorRegistro('');
            setMensajeExito('La asistencia se registró correctamente.');

            setPagina(1);

            /*
             * Actualizo el listado después de registrar el ingreso.
             */
            const respuesta = await asistenciasServicio.listar({
                pagina: 1,
                limite: 20,
                ...(clienteSeleccionado && {
                    cliente_id: clienteSeleccionado.id
                }),
                ...(fechaDesde && { fecha_desde: fechaDesde }),
                ...(fechaHasta && { fecha_hasta: fechaHasta })
            });

            setAsistencias(respuesta.asistencias ?? []);
            setPaginacion(respuesta.paginacion);
        } catch (error) {
            setErrorRegistro(
                error.response?.data?.mensaje ||
                error.response?.data?.message ||
                'No se pudo registrar la asistencia.'
            );
        } finally {
            setGuardando(false);
        }
    };

    if (!puedeConsultar) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-800">
                    No tenés permiso para consultar asistencias.
                </p>

                <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Volver al inicio
                </button>
            </div>
        );
    }

    const hayFiltros = Boolean(
        fechaDesde ||
        fechaHasta ||
        clienteSeleccionado
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Asistencias
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Controlá los ingresos y el historial de asistencia de los socios.
                    </p>
                </div>

                {puedeRegistrar && (
                    <button
                        type="button"
                        onClick={() => {
                            setErrorRegistro('');
                            setModalAbierto(true);
                        }}
                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        <Plus size={19} />
                        Registrar ingreso
                    </button>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Asistencias encontradas
                        </p>

                        <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                            <Users size={20} />
                        </div>
                    </div>

                    <p className="mt-3 text-3xl font-bold text-slate-900">
                        {cargando ? '—' : paginacion.total}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        Según los filtros aplicados
                    </p>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Página actual
                        </p>

                        <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
                            <RefreshCw size={20} />
                        </div>
                    </div>

                    <p className="mt-3 text-3xl font-bold text-slate-900">
                        {cargando
                            ? '—'
                            : `${paginacion.pagina} / ${paginacion.totalPaginas || 1}`}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                        20 registros por página
                    </p>
                </article>
            </div>

            {mensajeExito && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-medium text-emerald-700">
                        {mensajeExito}
                    </p>

                    <button
                        type="button"
                        onClick={() => setMensajeExito('')}
                        className="text-emerald-700 hover:text-emerald-900"
                        aria-label="Cerrar mensaje"
                    >
                        <X size={18} />
                    </button>
                </div>
            )}

            <section className="overflow-visible rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-2">
                    <div className="relative">
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Buscar cliente
                        </label>

                        <div className="relative">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="search"
                                value={busquedaCliente}
                                onChange={(evento) => {
                                    setBusquedaCliente(evento.target.value);
                                    setClienteSeleccionado(null);
                                    setPagina(1);
                                }}
                                placeholder="Nombre, apellido o documento..."
                                className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {buscandoClientes && (
                            <p className="mt-1 text-xs text-slate-500">
                                Buscando clientes...
                            </p>
                        )}

                        {clientesEncontrados.length > 0 && !clienteSeleccionado && (
                            <div className="absolute left-5 right-5 z-20 mt-1 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg lg:left-5 lg:right-5">
                                {clientesEncontrados.map((cliente) => (
                                    <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => seleccionarCliente(cliente)}
                                        className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                                    >
                                        <p className="text-sm font-semibold text-slate-800">
                                            {cliente.nombre} {cliente.apellido}
                                        </p>

                                        <p className="text-xs text-slate-500">
                                            {cliente.documento || cliente.email || 'Sin documento ni email'}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )}

                        {clienteSeleccionado && (
                            <p className="mt-2 text-xs font-medium text-blue-700">
                                Filtrando por {clienteSeleccionado.nombre}{' '}
                                {clienteSeleccionado.apellido}
                            </p>
                        )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label
                                htmlFor="fecha-desde"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Desde
                            </label>

                            <input
                                id="fecha-desde"
                                type="date"
                                value={fechaDesde}
                                max={fechaHasta || undefined}
                                onChange={(evento) => {
                                    setFechaDesde(evento.target.value);
                                    setPagina(1);
                                }}
                                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="fecha-hasta"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Hasta
                            </label>

                            <input
                                id="fecha-hasta"
                                type="date"
                                value={fechaHasta}
                                min={fechaDesde || undefined}
                                onChange={(evento) => {
                                    setFechaHasta(evento.target.value);
                                    setPagina(1);
                                }}
                                className="w-full rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    {hayFiltros && (
                        <div className="flex justify-end lg:col-span-2">
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                <X size={16} />
                                Limpiar filtros
                            </button>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={cargarAsistencias}
                            className="mt-2 text-sm font-semibold text-red-700 underline"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                <TablaAsistencias
                    asistencias={asistencias}
                    cargando={cargando}
                    onVer={(id) => navigate(`/asistencias/${id}`)}
                />

                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Mostrando {asistencias.length} de {paginacion.total} asistencias
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={pagina <= 1 || cargando}
                            onClick={() => setPagina((actual) => actual - 1)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={19} />
                        </button>

                        <span className="px-3 text-sm font-medium text-slate-700">
                            {pagina}
                        </span>

                        <button
                            type="button"
                            disabled={
                                pagina >= paginacion.totalPaginas ||
                                cargando
                            }
                            onClick={() => setPagina((actual) => actual + 1)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Página siguiente"
                        >
                            <ChevronRight size={19} />
                        </button>
                    </div>
                </div>
            </section>

            <RegistrarAsistenciaModal
                abierto={modalAbierto}
                onCerrar={() => {
                    if (!guardando) setModalAbierto(false);
                }}
                onRegistrar={manejarRegistro}
                guardando={guardando}
                error={errorRegistro}
            />
        </div>
    );
}

export default AsistenciasPage;