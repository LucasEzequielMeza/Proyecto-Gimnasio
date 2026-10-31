import {
    Users,
    CreditCard,
    CalendarCheck,
    UserCheck
} from 'lucide-react';

const indicadores = [
    {
        titulo: 'Clientes activos',
        valor: '—',
        descripcion: 'Clientes con estado activo',
        icono: Users
    },
    {
        titulo: 'Membresías vigentes',
        valor: '—',
        descripcion: 'Membresías actualmente activas',
        icono: UserCheck
    },
    {
        titulo: 'Ingresos del mes',
        valor: '—',
        descripcion: 'Total de pagos registrados',
        icono: CreditCard
    },
    {
        titulo: 'Asistencias de hoy',
        valor: '—',
        descripcion: 'Registros del día',
        icono: CalendarCheck
    }
];

function DashboardPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">
                    Dashboard
                </h1>

                <p className="mt-1 text-sm text-slate-500">
                    Resumen general de la actividad del gimnasio.
                </p>
            </div>

            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {indicadores.map((indicador) => {
                    const Icono = indicador.icono;

                    return (
                        <article
                            key={indicador.titulo}
                            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-sm font-medium text-slate-500">
                                    {indicador.titulo}
                                </p>

                                <div className="rounded-lg bg-blue-50 p-2.5 text-blue-600">
                                    <Icono size={21} />
                                </div>
                            </div>

                            <p className="mt-5 text-3xl font-bold text-slate-900">
                                {indicador.valor}
                            </p>

                            <p className="mt-2 text-xs text-slate-500">
                                {indicador.descripcion}
                            </p>
                        </article>
                    );
                })}
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold text-slate-900">
                        Actividad reciente
                    </h2>

                    <p className="mt-3 text-sm text-slate-500">
                        Aquí mostraremos los últimos movimientos del gimnasio.
                    </p>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <h2 className="font-semibold text-slate-900">
                        Próximas clases
                    </h2>

                    <p className="mt-3 text-sm text-slate-500">
                        Aquí mostraremos las próximas clases y reservas.
                    </p>
                </article>
            </section>
        </div>
    );
}

export default DashboardPage;