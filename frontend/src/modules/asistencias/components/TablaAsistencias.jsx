import { Eye, CalendarCheck, Dumbbell } from 'lucide-react';

function formatearFecha(fecha) {
    if (!fecha) return '—';

    const [anio, mes, dia] = fecha.toString().slice(0, 10).split('-');

    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fecha) {
    if (!fecha) return '—';

    return new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(fecha));
}

function formatearTipoPlan(tipo) {
    if (!tipo) return '';

    const tipos = {
        FIJO: 'Duración fija',
        MENSUAL: 'Mensual'
    };

    return tipos[tipo] || tipo;
}

function TablaAsistencias({
    asistencias,
    cargando,
    onVer
}) {
    if (cargando) {
        return (
            <div className="p-10 text-center text-sm text-slate-500">
                Cargando asistencias...
            </div>
        );
    }

    if (!asistencias.length) {
        return (
            <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="rounded-full bg-slate-100 p-4 text-slate-400">
                    <CalendarCheck size={28} />
                </div>

                <p className="mt-4 font-semibold text-slate-800">
                    No hay asistencias registradas
                </p>

                <p className="mt-1 text-sm text-slate-500">
                    No encontramos registros con los filtros seleccionados.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-left">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                        <th className="px-5 py-4 font-semibold">Cliente</th>
                        <th className="px-5 py-4 font-semibold">Plan</th>
                        <th className="px-5 py-4 font-semibold">Fecha</th>
                        <th className="px-5 py-4 font-semibold">Ingreso</th>
                        <th className="px-5 py-4 font-semibold">Registrado por</th>
                        <th className="px-5 py-4 text-right font-semibold">Acciones</th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                    {asistencias.map((asistencia) => (
                        <tr
                            key={asistencia.id}
                            className="transition hover:bg-slate-50"
                        >
                            <td className="px-5 py-4">
                                <p className="font-semibold text-slate-800">
                                    {asistencia.cliente_nombre}{' '}
                                    {asistencia.cliente_apellido}
                                </p>
                            </td>

                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <Dumbbell
                                        size={16}
                                        className="shrink-0 text-slate-400"
                                    />

                                    <div>
                                        <p className="text-sm font-medium text-slate-700">
                                            {asistencia.plan_nombre || 'Plan no disponible'}
                                        </p>

                                        {asistencia.tipo_plan && (
                                            <p className="mt-1 text-xs text-slate-400">
                                                {formatearTipoPlan(asistencia.tipo_plan)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                                {formatearFecha(asistencia.fecha)}
                            </td>

                            <td className="px-5 py-4 text-sm font-medium text-slate-700">
                                {formatearFechaHora(asistencia.fecha_hora)}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                                {asistencia.registrado_por_nombre}{' '}
                                {asistencia.registrado_por_apellido}
                            </td>

                            <td className="px-5 py-4 text-right">
                                <button
                                    type="button"
                                    onClick={() => onVer(asistencia.id)}
                                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                    <Eye size={16} />
                                    Ver detalle
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default TablaAsistencias;