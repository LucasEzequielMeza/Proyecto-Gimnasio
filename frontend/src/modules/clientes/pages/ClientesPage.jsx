import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    Users,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    X
} from 'lucide-react';

import TablaClientes from '../components/TablaClientes';
import clientesServicio from '../services/clientesServicio';
import { useAuth } from '../../../context/AuthContext';

function ClientesPage() {
    const navigate = useNavigate();
    const { usuario } = useAuth();

    const permisos = usuario?.permisos ?? [];

    const puedeConsultar = permisos.includes('clientes.consultar');
    const puedeCrear = permisos.includes('clientes.crear');
    const puedeEditar = permisos.includes('clientes.editar');

    const [clientes, setClientes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [estado, setEstado] = useState('');
    const [pagina, setPagina] = useState(1);

    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        limite: 20,
        total: 0,
        totalPaginas: 0
    });

    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const cargarClientes = useCallback(async () => {
        if (!puedeConsultar) {
            setCargando(false);
            return;
        }

        setCargando(true);
        setError('');

        try {
            const respuesta = await clientesServicio.listar({
                pagina,
                limite: 20,
                buscar: busqueda.trim(),
                ...(estado && { estado })
            });

            setClientes(respuesta.data || []);
            setPaginacion(respuesta.paginacion || {
                pagina: 1,
                limite: 20,
                total: 0,
                totalPaginas: 0
            });
        } catch (error) {
            setError(
                error.response?.data?.message ||
                error.response?.data?.mensaje ||
                'No se pudieron cargar los clientes.'
            );
        } finally {
            setCargando(false);
        }
    }, [pagina, busqueda, estado, puedeConsultar]);

    useEffect(() => {
        if (!puedeConsultar) {
            setCargando(false);
            return undefined;
        }

        const temporizador = setTimeout(() => {
            cargarClientes();
        }, 350);

        return () => clearTimeout(temporizador);
    }, [cargarClientes, puedeConsultar]);

    const manejarBusqueda = (valor) => {
        setBusqueda(valor);
        setPagina(1);
    };

    const manejarEstado = (valor) => {
        setEstado(valor);
        setPagina(1);
    };

    const limpiarFiltros = () => {
        setBusqueda('');
        setEstado('');
        setPagina(1);
    };

    if (!puedeConsultar) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-800">
                    No tenés permiso para consultar clientes.
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

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Clientes
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Consultá los clientes de tu gimnasio.
                    </p>
                </div>

                {puedeCrear && (
                    <button
                        type="button"
                        onClick={() => navigate('/clientes/nuevo')}
                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                        <Plus size={19} />
                        Nuevo cliente
                    </button>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-slate-500">
                            Clientes encontrados
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
                        20 clientes por página
                    </p>
                </article>
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center">
                    <div className="relative flex-1">
                        <Search
                            size={19}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="search"
                            value={busqueda}
                            onChange={(e) => manejarBusqueda(e.target.value)}
                            placeholder="Buscar por nombre, documento, email o teléfono..."
                            className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <select
                            value={estado}
                            onChange={(e) => manejarEstado(e.target.value)}
                            className="min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-blue-500"
                        >
                            <option value="">Todos los estados</option>
                            <option value="activo">Activos</option>
                            <option value="inactivo">Inactivos</option>
                        </select>

                        {(busqueda || estado) && (
                            <button
                                type="button"
                                onClick={limpiarFiltros}
                                className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
                            >
                                <X size={16} />
                                Limpiar
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-700">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={cargarClientes}
                            className="mt-2 text-sm font-semibold text-red-700 underline"
                        >
                            Reintentar
                        </button>
                    </div>
                )}

                <TablaClientes
                    clientes={clientes}
                    cargando={cargando}
                    puedeEditar={puedeEditar}
                    onVer={(id) => navigate(`/clientes/${id}`)}
                    onEditar={(id) => navigate(`/clientes/${id}/editar`)}
                />

                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Mostrando {clientes.length} de {paginacion.total} clientes
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
        </div>
    );
}

export default ClientesPage;