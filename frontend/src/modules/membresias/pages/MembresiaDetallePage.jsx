import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Pencil, Ban, X, AlertTriangle } from 'lucide-react';

import membresiasServicio from '../services/membresiasServicio';
import { useAuth } from '../../../context/AuthContext';

function MembresiaDetallePage() {
    const { id } = useParams();
    const navegar = useNavigate();
    const location = useLocation();
    const { csrfToken, usuario } = useAuth();

    const [membresia, setMembresia] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState(location.state?.mensaje || '');
    const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
    const [cancelando, setCancelando] = useState(false);

    const permisos = usuario?.permisos || [];
    const puedeEditar = permisos.includes('membresias.editar');
    const puedeCancelar = permisos.includes('membresias.cancelar');

    useEffect(() => {
        async function obtenerMembresia() {
            try {
                setCargando(true);
                setError('');

                const respuesta = await membresiasServicio.obtener(id);
                setMembresia(respuesta.data);
            } catch (error) {
                setError(error.response?.data?.message || 'No se pudo obtener la membresía.');
            } finally {
                setCargando(false);
            }
        }

        obtenerMembresia();
    }, [id]);

    useEffect(() => {
        if (!mensajeExito) return undefined;

        const temporizador = setTimeout(() => setMensajeExito(''), 4000);
        return () => clearTimeout(temporizador);
    }, [mensajeExito]);

    function formatearFecha(fecha) {
        if (!fecha) return '—';

        const [anio, mes, dia] = String(fecha).slice(0, 10).split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function formatearPrecio(precio) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0
        }).format(Number(precio));
    }

    async function confirmarCancelacion() {
        if (!membresia || cancelando) return;

        try {
            setCancelando(true);
            setError('');

            const respuesta = await membresiasServicio.cancelar(id, csrfToken);
            setMembresia(respuesta.data);
            setMostrarConfirmacion(false);
            setMensajeExito('La membresía se canceló correctamente.');
        } catch (error) {
            setError(error.response?.data?.message || 'No se pudo cancelar la membresía.');
        } finally {
            setCancelando(false);
        }
    }

    if (cargando) {
        return <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">Cargando membresía...</div>;
    }

    if (error && !membresia) {
        return (
            <div className="space-y-4">
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                <button type="button" onClick={() => navegar('/membresias')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Volver a membresías
                </button>
            </div>
        );
    }

    if (!membresia) return null;

    return (
        <>
            <div className="space-y-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => navegar('/membresias')} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" aria-label="Volver">
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-800">Detalle de membresía</h1>
                            <p className="mt-1 text-sm text-slate-500">Información de la contratación y su vigencia.</p>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {puedeEditar && membresia.estado === 'ACTIVA' && (
                            <button type="button" onClick={() => navegar(`/membresias/${id}/editar`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                                <Pencil size={16} />
                                Editar
                            </button>
                        )}
                        {puedeCancelar && membresia.estado === 'ACTIVA' && (
                            <button type="button" onClick={() => setMostrarConfirmacion(true)} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700">
                                <Ban size={16} />
                                Cancelar membresía
                            </button>
                        )}
                    </div>
                </div>

                {mensajeExito && (
                    <div role="status" className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                        <span>✓</span>
                        <p>{mensajeExito}</p>
                        <button type="button" onClick={() => setMensajeExito('')} className="ml-auto" aria-label="Cerrar">
                            <X size={17} />
                        </button>
                    </div>
                )}

                {error && (
                    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
                )}

                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-slate-500">Plan contratado</p>
                            <h2 className="mt-1 text-xl font-semibold text-slate-800">{membresia.plan_nombre}</h2>
                        </div>
                        <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-medium ${
                            membresia.estado === 'ACTIVA'
                                ? 'bg-green-100 text-green-700'
                                : membresia.estado === 'VENCIDA'
                                    ? 'bg-slate-100 text-slate-600'
                                    : 'bg-red-100 text-red-700'
                        }`}>
                            {membresia.estado === 'ACTIVA' ? 'Activa' : membresia.estado === 'VENCIDA' ? 'Vencida' : 'Cancelada'}
                        </span>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <p className="text-sm text-slate-500">Cliente</p>
                            <p className="mt-1 font-medium text-slate-800">{membresia.cliente_nombre} {membresia.cliente_apellido}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Precio registrado</p>
                            <p className="mt-1 font-medium text-slate-800">{formatearPrecio(membresia.precio)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Tipo de plan</p>
                            <p className="mt-1 font-medium text-slate-800">{membresia.tipo_plan === 'FIJO' ? 'Fijo' : 'Mensual'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Fecha de inicio</p>
                            <p className="mt-1 font-medium text-slate-800">{formatearFecha(membresia.fecha_inicio)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Fecha de vencimiento</p>
                            <p className="mt-1 font-medium text-slate-800">{formatearFecha(membresia.fecha_fin)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Duración</p>
                            <p className="mt-1 font-medium text-slate-800">{membresia.tipo_plan === 'MENSUAL' ? 'Mensual' : `${membresia.duracion_dias} días`}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Moneda</p>
                            <p className="mt-1 font-medium text-slate-800">{membresia.moneda || 'ARS'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Registrada</p>
                            <p className="mt-1 font-medium text-slate-800">{membresia.created_at ? new Date(membresia.created_at).toLocaleString('es-AR') : '—'}</p>
                        </div>
                    </div>
                </section>
            </div>

            {mostrarConfirmacion && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
                    onMouseDown={(evento) => {
                        if (evento.target === evento.currentTarget && !cancelando) {
                            setMostrarConfirmacion(false);
                        }
                    }}
                >
                    <div role="dialog" aria-modal="true" aria-labelledby="detalle-cancelacion-titulo" className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
                        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
                            <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                                    <AlertTriangle size={21} />
                                </div>
                                <div>
                                    <h2 id="detalle-cancelacion-titulo" className="text-lg font-semibold text-slate-900">Cancelar membresía</h2>
                                    <p className="mt-1 text-sm text-slate-500">Esta acción cambiará el estado de la membresía.</p>
                                </div>
                            </div>
                            <button type="button" onClick={() => setMostrarConfirmacion(false)} disabled={cancelando} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-50">
                                <X size={19} />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm leading-6 text-slate-600">¿Confirmás la cancelación de esta membresía?</p>
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                El registro se conservará en el historial y no podrá renovarse.
                            </div>
                        </div>
                        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                            <button type="button" onClick={() => setMostrarConfirmacion(false)} disabled={cancelando} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50">
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

export default MembresiaDetallePage;