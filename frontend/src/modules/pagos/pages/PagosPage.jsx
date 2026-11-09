import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    RefreshCw,
    Eye,
    CreditCard,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

import pagosServicio from '../services/pagosServicio';
import { useAuth } from '../../../context/AuthContext';

const LIMITE = 10;

const ESTADOS_OBLIGACION = {
    PENDIENTE: 'Pendiente',
    PAGADA: 'Pagada',
    VENCIDA: 'Vencida',
    CANCELADA: 'Cancelada'
};

const ESTADOS_PAGO = {
    PENDIENTE: 'Pendiente',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    CANCELADO: 'Cancelado',
    REEMBOLSADO: 'Reembolsado'
};

function formatearFecha(fecha) {
    if (!fecha) return '—';

    const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');

    return `${dia}/${mes}/${anio}`;
}

function formatearPrecio(monto, moneda = 'ARS') {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: moneda,
        maximumFractionDigits: 2
    }).format(Number(monto || 0));
}

function obtenerClaseEstado(estado) {
    const clases = {
        PAGADA: 'bg-green-100 text-green-700',
        APROBADO: 'bg-green-100 text-green-700',
        PENDIENTE: 'bg-amber-100 text-amber-700',
        VENCIDA: 'bg-red-100 text-red-700',
        RECHAZADO: 'bg-red-100 text-red-700',
        CANCELADA: 'bg-slate-100 text-slate-600',
        CANCELADO: 'bg-slate-100 text-slate-600',
        REEMBOLSADO: 'bg-purple-100 text-purple-700'
    };

    return clases[estado] || 'bg-slate-100 text-slate-600';
}

function PagosPage() {
    const navegar = useNavigate();
    const { usuario } = useAuth();

    const permisos = usuario?.permisos || [];
    const roles = usuario?.roles || [];

    const esPersonalAdministrativo =
        roles.includes('ADMIN') || roles.includes('RECEPCION');

    const [registros, setRegistros] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    const [busqueda, setBusqueda] = useState('');
    const [busquedaAplicada, setBusquedaAplicada] = useState('');
    const [estado, setEstado] = useState('');
    const [pagina, setPagina] = useState(1);

    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        limite: LIMITE,
        total: 0,
        totalPaginas: 0
    });

    const puedeConsultar = permisos.includes('pagos.consultar');

    const obtenerRegistros = useCallback(async () => {
        try {
            setCargando(true);
            setError('');

            const filtros = {
                pagina,
                limite: LIMITE,
                ...(estado && { estado })
            };

            let respuesta;

            if (esPersonalAdministrativo) {
                respuesta = await pagosServicio.listarObligaciones({
                    ...filtros,
                    busqueda: busquedaAplicada
                });

                setRegistros(respuesta.obligaciones || []);
            } else {
                respuesta = await pagosServicio.listarPagos(filtros);
                setRegistros(respuesta.pagos || []);
            }

            setPaginacion(respuesta.paginacion || {
                pagina: 1,
                limite: LIMITE,
                total: 0,
                totalPaginas: 0
            });
        } catch (errorConsulta) {
            setError(
                errorConsulta.response?.data?.mensaje ||
                'No se pudieron obtener los registros de pago.'
            );
        } finally {
            setCargando(false);
        }
    }, [
        pagina,
        estado,
        busquedaAplicada,
        esPersonalAdministrativo
    ]);

    useEffect(() => {
        obtenerRegistros();
    }, [obtenerRegistros]);

    function buscar(evento) {
        evento.preventDefault();
        setPagina(1);
        setBusquedaAplicada(busqueda.trim());
    }

    function limpiarFiltros() {
        setBusqueda('');
        setBusquedaAplicada('');
        setEstado('');
        setPagina(1);
    }

    if (!puedeConsultar) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                No tenés permiso para consultar pagos.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">
                    Pagos
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    {esPersonalAdministrativo
                        ? 'Administrá las obligaciones de pago de los clientes.'
                        : 'Consultá el historial de tus pagos.'}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                        {esPersonalAdministrativo
                            ? 'Obligaciones encontradas'
                            : 'Pagos encontrados'}
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
                        {paginacion.pagina} de {paginacion.totalPaginas || 1}
                    </p>
                </div>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <form
                    onSubmit={buscar}
                    className="grid grid-cols-1 gap-3 md:grid-cols-4"
                >
                    {esPersonalAdministrativo && (
                        <div className="relative md:col-span-3">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="text"
                                value={busqueda}
                                onChange={(evento) => setBusqueda(evento.target.value)}
                                placeholder="Buscar por cliente o plan..."
                                className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    )}

                    <select
                        value={estado}
                        onChange={(evento) => {
                            setEstado(evento.target.value);
                            setPagina(1);
                        }}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
                    >
                        <option value="">Todos los estados</option>

                        {esPersonalAdministrativo ? (
                            <>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="PAGADA">Pagada</option>
                                <option value="VENCIDA">Vencida</option>
                                <option value="CANCELADA">Cancelada</option>
                            </>
                        ) : (
                            <>
                                <option value="PENDIENTE">Pendiente</option>
                                <option value="APROBADO">Aprobado</option>
                                <option value="RECHAZADO">Rechazado</option>
                                <option value="CANCELADO">Cancelado</option>
                                <option value="REEMBOLSADO">Reembolsado</option>
                            </>
                        )}
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
                            onClick={limpiarFiltros}
                            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Limpiar filtros
                        </button>

                        <button
                            type="button"
                            onClick={obtenerRegistros}
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
                        Cargando registros...
                    </div>
                ) : registros.length === 0 ? (
                    <div className="py-12 text-center">
                        <CreditCard
                            size={32}
                            className="mx-auto text-slate-300"
                        />

                        <p className="mt-3 font-medium text-slate-700">
                            No se encontraron registros
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                            Probá modificando los filtros.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                {esPersonalAdministrativo ? (
                                    <tr>
                                        <th className="px-5 py-4">Cliente</th>
                                        <th className="px-5 py-4">Plan</th>
                                        <th className="px-5 py-4">Período</th>
                                        <th className="px-5 py-4">Vencimiento</th>
                                        <th className="px-5 py-4">Importe</th>
                                        <th className="px-5 py-4">Estado</th>
                                        <th className="px-5 py-4 text-right">Acciones</th>
                                    </tr>
                                ) : (
                                    <tr>
                                        <th className="px-5 py-4">Fecha</th>
                                        <th className="px-5 py-4">Período</th>
                                        <th className="px-5 py-4">Importe</th>
                                        <th className="px-5 py-4">Medio</th>
                                        <th className="px-5 py-4">Estado</th>
                                    </tr>
                                )}
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {registros.map((registro) => (
                                    <tr
                                        key={registro.id}
                                        className="transition hover:bg-slate-50"
                                    >
                                        {esPersonalAdministrativo ? (
                                            <>
                                                <td className="px-5 py-4 font-medium text-slate-800">
                                                    {registro.cliente_nombre} {registro.cliente_apellido}
                                                </td>

                                                <td className="px-5 py-4">
                                                    {registro.plan_nombre}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4">
                                                    {formatearFecha(registro.periodo_inicio)}
                                                    {' - '}
                                                    {formatearFecha(registro.periodo_fin)}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4">
                                                    {formatearFecha(registro.fecha_vencimiento)}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                                                    {formatearPrecio(registro.monto, registro.moneda)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${obtenerClaseEstado(registro.estado)}`}>
                                                        {ESTADOS_OBLIGACION[registro.estado] || registro.estado}
                                                    </span>
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <button
                                                        type="button"
                                                        title="Ver obligación"
                                                        aria-label="Ver obligación"
                                                        onClick={() => navegar(`/pagos/obligaciones/${registro.id}`)}
                                                        className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td className="whitespace-nowrap px-5 py-4">
                                                    {formatearFecha(registro.fecha_pago || registro.created_at)}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4">
                                                    {registro.periodo_inicio
                                                        ? `${formatearFecha(registro.periodo_inicio)} - ${formatearFecha(registro.periodo_fin)}`
                                                        : '—'}
                                                </td>

                                                <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                                                    {formatearPrecio(registro.monto, registro.moneda)}
                                                </td>

                                                <td className="px-5 py-4">
                                                    {registro.medio_pago || '—'}
                                                </td>

                                                <td className="px-5 py-4">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${obtenerClaseEstado(registro.estado)}`}>
                                                        {ESTADOS_PAGO[registro.estado] || registro.estado}
                                                    </span>
                                                </td>
                                            </>
                                        )}
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
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <ChevronLeft size={16} />
                                Anterior
                            </button>

                            <button
                                type="button"
                                disabled={pagina >= paginacion.totalPaginas}
                                onClick={() => setPagina((actual) => actual + 1)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Siguiente
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}

export default PagosPage;