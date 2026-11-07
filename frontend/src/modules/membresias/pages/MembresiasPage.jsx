import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, Eye, Pencil, Ban, X, AlertTriangle } from 'lucide-react';

import membresiasServicio from '../services/membresiasServicio';
import { useAuth } from '../../../context/AuthContext';

function MembresiasPage() {
    const navegar = useNavigate();
    const location = useLocation();
    const { csrfToken, usuario } = useAuth();

    const [membresias, setMembresias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [estado, setEstado] = useState('');
    const [pagina, setPagina] = useState(1);
    const [membresiaSeleccionada, setMembresiaSeleccionada] = useState(null);
    const [cancelando, setCancelando] = useState(false);

    const permisos = usuario?.permisos || [];
    const puedeCrear = permisos.includes('membresias.crear');
    const puedeEditar = permisos.includes('membresias.editar');
    const puedeCancelar = permisos.includes('membresias.cancelar');

    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        limite: 10,
        total: 0,
        totalPaginas: 0
    });

    const obtenerMembresias = useCallback(async () => {
        try {
            setCargando(true);
            setError('');

            const respuesta = await membresiasServicio.listar({
                pagina,
                limite: 10,
                busqueda: busquedaAplicada,
                ...(estado && { estado })
            });

            setMembresias(respuesta.data || []);
            setPaginacion(respuesta.paginacion || {
                pagina: 1,
                limite: 10,
                total: 0,
                totalPaginas: 0
            });
        } catch (error) {
            setError(error.response?.data?.message || 'No se pudieron obtener las membresías.');
        } finally {
            setCargando(false);
        }
    }, [pagina, busquedaAplicada, estado]);

    useEffect(() => {
        obtenerMembresias();
    }, [obtenerMembresias]);

    useEffect(() => {
        if (location.state?.mensaje) {
            setMensajeExito(location.state.mensaje);
            navegar(location.pathname, { replace: true, state: {} });
        }
    }, [location, navegar]);

    useEffect(() => {
        if (!mensajeExito) return undefined;

        const temporizador = setTimeout(() => setMensajeExito(''), 4000);
        return () => clearTimeout(temporizador);
    }, [mensajeExito]);

    function buscar(evento) {
        evento.preventDefault();
        setPagina(1);
        setBusquedaAplicada(busqueda.trim());
    }

    function formatearPrecio(precio) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0
        }).format(Number(precio));
    }

    function formatearFecha(fecha) {
        if (!fecha) return '—';

        const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function abrirConfirmacion(membresia) {
        setError('');
        setMembresiaSeleccionada(membresia);
    }

    function cerrarConfirmacion() {
        if (cancelando) return;
        setMembresiaSeleccionada(null);
    }

    async function confirmarCancelacion() {
        if (!membresiaSeleccionada || cancelando) return;

        try {
            setCancelando(true);
            setError('');

            await membresiasServicio.cancelar(membresiaSeleccionada.id, csrfToken);
            setMembresiaSeleccionada(null);
            setMensajeExito('La membresía se canceló correctamente.');
            await obtenerMembresias();
        } catch (error) {
            setError(error.response?.data?.message || 'No se pudo cancelar la membresía.');
        } finally {
            setCancelando(false);
        }
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Membresías</h1>
                        <p className="mt-1 text-sm text-slate-500">Administrá las contrataciones y vigencia de los clientes.</p>
                    </div>
                    {puedeCrear && (
                        <button type="button" onClick={() => navegar('/membresias/nueva')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700">
                            <Plus size={18} />
                            Nueva membresía
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-500">Membresías encontradas</p>
                        <p className="mt-2 text-2xl font-bold text-slate-800">{paginacion.total}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-500">Página actual</p>
                        <p className="mt-2 text-2xl font-bold text-slate-800">{paginacion.pagina} de {paginacion.totalPaginas}</p>
                    </div>
                </div>

                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <form onSubmit={buscar} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        <div className="relative md:col-span-3">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={busqueda}
                                onChange={(evento) => setBusqueda(evento.target.value)}
                                placeholder="Buscar por cliente o plan..."
                                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <select
                            value={estado}
                            onChange={(evento) => {
                                setEstado(evento.target.value);
                                setPagina(1);
                            }}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                        >
                            <option value="">Todos los estados</option>
                            <option value="ACTIVA">Activa</option>
                            <option value="VENCIDA">Vencida</option>
                            <option value="CANCELADA">Cancelada</option>
                        </select>
                        <div className="flex flex-wrap gap-2 md:col-span-4 md:justify-end">
                            <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700">
                                <Search size={16} />
                                Buscar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setBusqueda('');
                                    setBusquedaAplicada('');
                                    setEstado('');
                                    setPagina(1);
                                }}
                                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Limpiar filtros
                            </button>
                            <button type="button" onClick={obtenerMembresias} disabled={cargando} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                                <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
                                Actualizar
                            </button>
                        </div>
                    </form>
                </section>

                {mensajeExito && (
                    <div role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <span>✓</span>
                        <p>{mensajeExito}</p>
                        <button type="button" onClick={() => setMensajeExito('')} className="ml-auto" aria-label="Cerrar mensaje">
                            <X size={17} />
                        </button>
                    </div>
                )}

                {error && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    {cargando ? (
                        <div className="py-12 text-center text-sm text-slate-500">Cargando membresías...</div>
                    ) : membresias.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="font-medium text-slate-700">No se encontraron membresías</p>
                            <p className="mt-1 text-sm text-slate-500">Probá modificando los filtros o registrando una nueva membresía.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="px-5 py-4">Cliente</th>
                                        <th className="px-5 py-4">Plan</th>
                                        <th className="px-5 py-4">Inicio</th>
                                        <th className="px-5 py-4">Vencimiento</th>
                                        <th className="px-5 py-4">Precio</th>
                                        <th className="px-5 py-4">Estado</th>
                                        <th className="px-5 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {membresias.map((membresia) => (
                                        <tr key={membresia.id} className="transition hover:bg-slate-50">
                                            <td className="px-5 py-4 font-medium text-slate-800">
                                                {membresia.cliente_nombre} {membresia.cliente_apellido}
                                            </td>
                                            <td className="px-5 py-4">{membresia.plan_nombre}</td>
                                            <td className="whitespace-nowrap px-5 py-4">{formatearFecha(membresia.fecha_inicio)}</td>
                                            <td className="whitespace-nowrap px-5 py-4">{formatearFecha(membresia.fecha_fin)}</td>
                                            <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">{formatearPrecio(membresia.precio)}</td>
                                            <td className="px-5 py-4">
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                                                    membresia.estado === 'ACTIVA'
                                                        ? 'bg-green-100 text-green-700'
                                                        : membresia.estado === 'VENCIDA'
                                                            ? 'bg-slate-100 text-slate-600'
                                                            : 'bg-red-100 text-red-700'
                                                }`}>
                                                    {membresia.estado === 'ACTIVA' ? 'Activa' : membresia.estado === 'VENCIDA' ? 'Vencida' : 'Cancelada'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex justify-end gap-2">
                                                    <button type="button" title="Ver detalle" aria-label="Ver detalle" onClick={() => navegar(`/membresias/${membresia.id}`)} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100">
                                                        <Eye size={18} />
                                                    </button>
                                                    {puedeEditar && membresia.estado === 'ACTIVA' && (
                                                        <button type="button" title="Editar membresía" aria-label="Editar membresía" onClick={() => navegar(`/membresias/${membresia.id}/editar`)} className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50">
                                                            <Pencil size={18} />
                                                        </button>
                                                    )}
                                                    {puedeCancelar && membresia.estado === 'ACTIVA' && (
                                                        <button type="button" title="Cancelar membresía" aria-label="Cancelar membresía" onClick={() => abrirConfirmacion(membresia)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50">
                                                            <Ban size={18} />
                                                        </button>
                                                    )}
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
                            <p className="text-sm text-slate-500">Mostrando página {paginacion.pagina} de {paginacion.totalPaginas}</p>
                            <div className="flex gap-2">
                                <button type="button" disabled={pagina <= 1} onClick={() => setPagina((actual) => actual - 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    Anterior
                                </button>
                                <button type="button" disabled={pagina >= paginacion.totalPaginas} onClick={() => setPagina((actual) => actual + 1)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            </div>

            {membresiaSeleccionada && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget && !cancelando) {
                            cerrarConfirmacion();
                        }
                    }}
                >
                    <div role="dialog" aria-modal="true" aria-labelledby="cancelacion-titulo" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                    <AlertTriangle size={21} />
                                </div>
                                <div>
                                    <h2 id="cancelacion-titulo" className="text-lg font-semibold text-slate-900">Cancelar membresía</h2>
                                    <p className="mt-1 text-sm text-slate-500">Confirmá esta operación para continuar.</p>
                                </div>
                            </div>
                            <button type="button" onClick={cerrarConfirmacion} disabled={cancelando} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
                                <X size={19} />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm leading-6 text-slate-600">
                                ¿Estás seguro de que querés cancelar la membresía de{' '}
                                <span className="font-semibold text-slate-900">
                                    {membresiaSeleccionada.cliente_nombre} {membresiaSeleccionada.cliente_apellido}
                                </span>?
                            </p>
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                La membresía quedará cancelada y no podrá renovarse. Su registro histórico se conservará.
                            </div>
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={cerrarConfirmacion} disabled={cancelando} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                                Volver
                            </button>
                            <button type="button" onClick={confirmarCancelacion} disabled={cancelando} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">
                                <Ban size={16} />
                                {cancelando ? 'Procesando...' : 'Confirmar cancelación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default MembresiasPage;