import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    CalendarCheck,
    Clock,
    UserRound,
    ShieldCheck,
    FileText,
    LoaderCircle,
    Dumbbell,
    CalendarDays
} from 'lucide-react';

import asistenciasServicio from '../services/asistenciasServicio';
import { useAuth } from '../../../context/AuthContext';

function formatearFecha(fecha) {
    if (!fecha) return '—';

    const [anio, mes, dia] = fecha.toString().slice(0, 10).split('-');

    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fecha) {
    if (!fecha) return '—';

    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'long',
        timeStyle: 'short'
    }).format(new Date(fecha));
}

function formatearTipoPlan(tipo) {
    if (!tipo) return '—';

    const tipos = {
        FIJO: 'Duración fija',
        MENSUAL: 'Mensual'
    };

    return tipos[tipo] || tipo;
}

function AsistenciaDetallePage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { usuario } = useAuth();

    const puedeConsultar = (
        usuario?.permisos ?? []
    ).includes('asistencias.consultar');

    const [asistencia, setAsistencia] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let activo = true;

        const cargarAsistencia = async () => {
            if (!puedeConsultar) {
                setCargando(false);
                return;
            }

            setCargando(true);
            setError('');

            try {
                const respuesta = await asistenciasServicio.obtener(id);

                if (activo) {
                    setAsistencia(respuesta.asistencia);
                }
            } catch (error) {
                if (activo) {
                    setError(
                        error.response?.data?.mensaje ||
                        error.response?.data?.message ||
                        'No se pudo obtener la asistencia.'
                    );
                }
            } finally {
                if (activo) setCargando(false);
            }
        };

        cargarAsistencia();

        return () => {
            activo = false;
        };
    }, [id, puedeConsultar]);

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

    if (cargando) {
        return (
            <div className="flex min-h-64 items-center justify-center gap-3 text-slate-500">
                <LoaderCircle size={22} className="animate-spin" />
                <span className="text-sm">Cargando asistencia...</span>
            </div>
        );
    }

    if (error || !asistencia) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-red-600">
                    {error || 'No se encontró la asistencia.'}
                </p>

                <button
                    type="button"
                    onClick={() => navigate('/asistencias')}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Volver a asistencias
                </button>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <button
                type="button"
                onClick={() => navigate('/asistencias')}
                className="flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-blue-600"
            >
                <ArrowLeft size={18} />
                Volver a asistencias
            </button>

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Detalle de asistencia
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Información del ingreso registrado.
                    </p>
                </div>

                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                    <CalendarCheck size={17} />
                    Ingreso registrado
                </span>
            </div>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                    <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                        <UserRound size={25} />
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Cliente
                        </p>

                        <h2 className="mt-1 text-xl font-bold text-slate-900">
                            {asistencia.cliente_nombre}{' '}
                            {asistencia.cliente_apellido}
                        </h2>
                    </div>
                </div>

                <div className="grid gap-6 pt-6 sm:grid-cols-2">
                    <div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <CalendarCheck size={17} />
                            <p className="text-xs font-medium uppercase tracking-wide">
                                Fecha de asistencia
                            </p>
                        </div>

                        <p className="mt-2 font-semibold text-slate-800">
                            {formatearFecha(asistencia.fecha)}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <Clock size={17} />
                            <p className="text-xs font-medium uppercase tracking-wide">
                                Fecha y hora exactas
                            </p>
                        </div>

                        <p className="mt-2 font-semibold text-slate-800">
                            {formatearFechaHora(asistencia.fecha_hora)}
                        </p>
                    </div>

                    <div>
                        <div className="flex items-center gap-2 text-slate-400">
                            <ShieldCheck size={17} />
                            <p className="text-xs font-medium uppercase tracking-wide">
                                Registrado por
                            </p>
                        </div>

                        <p className="mt-2 font-semibold text-slate-800">
                            {asistencia.registrado_por_nombre}{' '}
                            {asistencia.registrado_por_apellido}
                        </p>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                    <div className="rounded-xl bg-violet-50 p-3 text-violet-600">
                        <Dumbbell size={23} />
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Membresía asociada
                        </p>

                        <h3 className="mt-1 text-lg font-bold text-slate-900">
                            {asistencia.plan_nombre || 'Plan no disponible'}
                        </h3>
                    </div>
                </div>

                <div className="grid gap-6 pt-5 sm:grid-cols-2">
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Tipo de plan
                        </p>

                        <p className="mt-2 font-semibold text-slate-800">
                            {formatearTipoPlan(asistencia.tipo_plan)}
                        </p>
                    </div>

                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                            Período de vigencia
                        </p>

                        <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
                            <CalendarDays size={17} className="text-slate-400" />

                            {formatearFecha(asistencia.membresia_fecha_inicio)}
                            <span className="text-slate-400">—</span>
                            {formatearFecha(asistencia.membresia_fecha_fin)}
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2">
                    <FileText size={19} className="text-slate-400" />

                    <h3 className="font-semibold text-slate-800">
                        Observaciones
                    </h3>
                </div>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                    {asistencia.observaciones || 'No se registraron observaciones.'}
                </p>
            </section>

            <p className="text-center text-xs text-slate-400">
                Este registro forma parte del historial de asistencias y no puede editarse ni eliminarse desde el sistema.
            </p>
        </div>
    );
}

export default AsistenciaDetallePage;