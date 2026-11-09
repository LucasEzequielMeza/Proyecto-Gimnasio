import {
    Eye,
    Pencil,
    UserRound,
    Users
} from 'lucide-react';

function TablaClientes({
    clientes,
    cargando,
    puedeEditar = false,
    onVer,
    onEditar
}) {
    if (cargando) {
        return (
            <div className="flex justify-center py-16">
                <p className="text-sm text-slate-500">
                    Cargando clientes...
                </p>
            </div>
        );
    }

    if (clientes.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="mb-4 rounded-full bg-slate-100 p-4 text-slate-400">
                    <Users size={30} />
                </div>

                <h3 className="font-semibold text-slate-800">
                    No se encontraron clientes
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                    Probá modificando los filtros de búsqueda.
                </p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left">
                <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Cliente
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Documento
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Contacto
                        </th>

                        <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Estado
                        </th>

                        <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Acciones
                        </th>
                    </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                    {clientes.map((cliente) => (
                        <tr
                            key={cliente.id}
                            className="transition hover:bg-slate-50"
                        >
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                                        <UserRound size={19} />
                                    </div>

                                    <div>
                                        <p className="text-sm font-semibold text-slate-800">
                                            {cliente.nombre} {cliente.apellido}
                                        </p>

                                        <p className="mt-0.5 text-xs text-slate-500">
                                            {cliente.email || 'Sin email'}
                                        </p>
                                    </div>
                                </div>
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                                {cliente.documento || '—'}
                            </td>

                            <td className="px-5 py-4 text-sm text-slate-600">
                                {cliente.telefono || '—'}
                            </td>

                            <td className="px-5 py-4">
                                <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                        cliente.estado === 'activo'
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-slate-100 text-slate-600'
                                    }`}
                                >
                                    {cliente.estado === 'activo'
                                        ? 'Activo'
                                        : 'Inactivo'}
                                </span>
                            </td>

                            <td className="px-5 py-4">
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onVer(cliente.id)}
                                        title="Ver cliente"
                                        aria-label="Ver cliente"
                                        className="rounded-lg p-2 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600"
                                    >
                                        <Eye size={18} />
                                    </button>

                                    {puedeEditar && (
                                        <button
                                            type="button"
                                            onClick={() => onEditar(cliente.id)}
                                            title="Editar cliente"
                                            aria-label="Editar cliente"
                                            className="rounded-lg p-2 text-slate-500 transition hover:bg-amber-50 hover:text-amber-600"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default TablaClientes;