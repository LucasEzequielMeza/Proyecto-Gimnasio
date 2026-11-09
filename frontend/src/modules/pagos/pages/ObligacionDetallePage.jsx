import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    CreditCard,
    Ban,
    RefreshCw,
    CalendarDays,
    UserRound,
    Receipt,
    AlertTriangle
} from 'lucide-react';

import pagosServicio from '../services/pagosServicio';
import { useAuth } from '../../../context/AuthContext';

const ESTADOS = {
    PENDIENTE: 'Pendiente',
    PAGADA: 'Pagada',
    VENCIDA: 'Vencida',
    CANCELADA: 'Cancelada',
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

function ObligacionDetallePage() {
    const { id } = useParams();
    const navegar = useNavigate();
    const { csrfToken, usuario } = useAuth();

    const permisos = usuario?.permisos || [];
    const roles = usuario?.roles || [];

    const esPersonalAdministrativo =
        roles.includes('ADMIN') || roles.includes('RECEPCION');

    const puedeRegistrar = permisos.includes('pagos.registrar');
    const puedeCancelar = permisos.includes('pagos.obligaciones.cancelar');

    const [obligacion, setObligacion] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    const [medioPago, setMedioPago] = useState('EFECTIVO');
    const [registrando, setRegistrando] = useState(false);
    const [cancelando, setCancelando] = useState(false);
    const [mostrarCancelacion, setMostrarCancelacion] = useState(false);

    const obtenerDetalle = useCallback(async () => {
        try {
            setCargando(true);
            setError('');

            const respuesta = await pagosServicio.obtenerObligacion(id);

            setObligacion(respuesta.obligacion);
        } catch (errorConsulta) {
            setError(
                errorConsulta.response?.data?.mensaje ||
                'No se pudo obtener el detalle de la obligación.'
            );
        } finally {
            setCargando(false);
        }
    }, [id]);

    useEffect(() => {
        obtenerDetalle();
    }, [obtenerDetalle]);

    async function registrarPago(evento) {
        evento.preventDefault();

        if (!obligacion || registrando) return;

        try {
            setRegistrando(true);
            setError('');
            setMensajeExito('');

            await pagosServicio.crearPago({
                obligacion_id: obligacion.id,
                medio_pago: medioPago
            }, csrfToken);

            setMensajeExito('El pago se registró correctamente.');
            await obtenerDetalle();
        } catch (errorPago) {
            setError(
                errorPago.response?.data?.mensaje ||
                'No se pudo registrar el pago.'
            );
        } finally {
            setRegistrando(false);
        }
    }

    async function confirmarCancelacion() {
        if (!obligacion || cancelando) return;

        try {
            setCancelando(true);
            setError('');

            await pagosServicio.cancelarObligacion(
                obligacion.id,
                csrfToken
            );

            setMostrarCancelacion(false);
            setMensajeExito('La obligación se canceló correctamente.');

            await obtenerDetalle();
        } catch (errorCancelacion) {
            setError(
                errorCancelacion.response?.data?.mensaje ||
                'No se pudo cancelar la obligación.'
            );
        } finally {
            setCancelando(false);
        }
    }

    if (!esPersonalAdministrativo) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                No tenés permiso para consultar obligaciones de pago.
            </div>
        );
    }

    if (cargando) {
        return (
            <div className="py-12 text-center text-sm text-slate-500">
                Cargando obligación...
            </div>
        );
    }

    if (!obligacion) {
        return (
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => navegar('/pagos')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
                >
                    <ArrowLeft size={17} />
                    Volver a pagos
                </button>

                <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                    {error || 'No se encontró la obligación.'}
                </div>
            </div>
        );
    }

    const puedeCobrar =
        puedeRegistrar &&
        ['PENDIENTE', 'VENCIDA'].includes(obligacion.estado);

    const puedeAnular =
        puedeCancelar &&
        ['PENDIENTE', 'VENCIDA'].includes(obligacion.estado);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <button
                        type="button"
                        onClick={() => navegar('/pagos')}
                        className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
                    >
                        <ArrowLeft size={17} />
                        Volver a pagos
                    </button>

                    <h1 className="text-2xl font-bold text-slate-800">
                        Detalle de obligación
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Consultá el estado y el historial de esta obligación.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={obtenerDetalle}
                    disabled={cargando}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    <RefreshCw size={16} />
                    Actualizar
                </button>
            </div>

            {mensajeExito && (
                <div
                    role="status"
                    className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
                >
                    {mensajeExito}
                </div>
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                            <Receipt size={21} />
                        </div>

                        <div>
                            <p className="text-sm text-slate-500">
                                Importe de la obligación
                            </p>

                            <p className="text-2xl font-bold text-slate-800">
                                {formatearPrecio(obligacion.monto, obligacion.moneda)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm text-slate-500">
                        Estado de la obligación
                    </p>

                    <span className={`mt-3 inline-flex rounded-full px-3 py-1.5 text-sm font-medium ${obtenerClaseEstado(obligacion.estado)}`}>
                        {ESTADOS[obligacion.estado] || obligacion.estado}
                    </span>
                </div>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800">
                    Información de la obligación
                </h2>

                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <UserRound size={16} />
                            Cliente
                        </div>

                        <p className="mt-1 font-medium text-slate-800">
                            {obligacion.cliente_nombre} {obligacion.cliente_apellido}
                        </p>

                        {obligacion.cliente_email && (
                            <p className="mt-1 text-xs text-slate-500">
                                {obligacion.cliente_email}
                            </p>
                        )}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <CreditCard size={16} />
                            Plan
                        </div>

                        <p className="mt-1 font-medium text-slate-800">
                            {obligacion.plan_nombre}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <CalendarDays size={16} />
                            Vencimiento
                        </div>

                        <p className="mt-1 font-medium text-slate-800">
                            {formatearFecha(obligacion.fecha_vencimiento)}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500">
                            Inicio del período
                        </p>

                        <p className="mt-1 font-medium text-slate-800">
                            {formatearFecha(obligacion.periodo_inicio)}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500">
                            Fin del período
                        </p>

                        <p className="mt-1 font-medium text-slate-800">
                            {formatearFecha(obligacion.periodo_fin)}
                        </p>
                    </div>

                    <div>
                        <p className="text-sm text-slate-500">
                            Fecha de creación
                        </p>

                        <p className="mt-1 font-medium text-slate-800">
                            {formatearFecha(obligacion.created_at)}
                        </p>
                    </div>
                </div>
            </section>

            {puedeCobrar && (
                <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-800">
                        Registrar pago
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        El pago se registrará como aprobado y la obligación quedará pagada.
                    </p>

                    <form
                        onSubmit={registrarPago}
                        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
                    >
                        <div className="w-full sm:max-w-xs">
                            <label
                                htmlFor="medio-pago"
                                className="mb-2 block text-sm font-medium text-slate-700"
                            >
                                Medio de pago
                            </label>

                            <select
                                id="medio-pago"
                                value={medioPago}
                                onChange={(evento) => setMedioPago(evento.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="EFECTIVO">Efectivo</option>
                                <option value="TRANSFERENCIA">Transferencia</option>
                                <option value="TARJETA">Tarjeta</option>
                                <option value="OTRO">Otro</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={registrando}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                            <CreditCard size={17} />
                            {registrando ? 'Registrando...' : 'Confirmar pago'}
                        </button>
                    </form>
                </section>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 px-5 py-4">
                    <h2 className="text-lg font-semibold text-slate-800">
                        Historial de pagos
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                        {obligacion.pagos?.length || 0} registro(s) asociado(s) a esta obligación.
                    </p>
                </div>

                {!obligacion.pagos?.length ? (
                    <div className="py-10 text-center text-sm text-slate-500">
                        Esta obligación todavía no tiene pagos registrados.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                                <tr>
                                    <th className="px-5 py-4">Fecha</th>
                                    <th className="px-5 py-4">Proveedor</th>
                                    <th className="px-5 py-4">Medio</th>
                                    <th className="px-5 py-4">Importe</th>
                                    <th className="px-5 py-4">Estado</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-100">
                                {obligacion.pagos.map((pago) => (
                                    <tr key={pago.id}>
                                        <td className="whitespace-nowrap px-5 py-4">
                                            {formatearFecha(pago.fecha_pago || pago.created_at)}
                                        </td>

                                        <td className="px-5 py-4">
                                            {pago.proveedor}
                                        </td>

                                        <td className="px-5 py-4">
                                            {pago.medio_pago || '—'}
                                        </td>

                                        <td className="whitespace-nowrap px-5 py-4 font-medium text-slate-800">
                                            {formatearPrecio(pago.monto, pago.moneda)}
                                        </td>

                                        <td className="px-5 py-4">
                                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${obtenerClaseEstado(pago.estado)}`}>
                                                {ESTADOS[pago.estado] || pago.estado}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {puedeAnular && (
                <section className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="font-semibold text-red-800">
                            Cancelar obligación
                        </h2>

                        <p className="mt-1 text-sm text-red-700">
                            La obligación quedará cancelada y se conservará su historial.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => setMostrarCancelacion(true)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
                    >
                        <Ban size={17} />
                        Cancelar obligación
                    </button>
                </section>
            )}

            {mostrarCancelacion && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="cancelar-obligacion-titulo"
                        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
                    >
                        <div className="flex items-start gap-3 border-b border-slate-100 px-6 py-5">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                <AlertTriangle size={21} />
                            </div>

                            <div>
                                <h2
                                    id="cancelar-obligacion-titulo"
                                    className="text-lg font-semibold text-slate-900"
                                >
                                    Confirmar cancelación
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    Esta operación no se puede deshacer desde esta pantalla.
                                </p>
                            </div>
                        </div>

                        <div className="px-6 py-5">
                            <p className="text-sm leading-6 text-slate-600">
                                ¿Querés cancelar la obligación de{' '}
                                <strong>
                                    {formatearPrecio(obligacion.monto, obligacion.moneda)}
                                </strong>{' '}
                                correspondiente al período{' '}
                                <strong>
                                    {formatearFecha(obligacion.periodo_inicio)}
                                    {' - '}
                                    {formatearFecha(obligacion.periodo_fin)}
                                </strong>?
                            </p>
                        </div>

                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                onClick={() => setMostrarCancelacion(false)}
                                disabled={cancelando}
                                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                                Volver
                            </button>

                            <button
                                type="button"
                                onClick={confirmarCancelacion}
                                disabled={cancelando}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                            >
                                <Ban size={16} />
                                {cancelando ? 'Procesando...' : 'Confirmar cancelación'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ObligacionDetallePage;