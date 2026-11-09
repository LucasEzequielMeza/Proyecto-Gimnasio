import { useEffect, useState } from 'react';
import {
    Search,
    X,
    UserRound,
    LoaderCircle,
    CalendarCheck
} from 'lucide-react';

import clientesServicio from '../../clientes/services/clientesServicio';

function RegistrarAsistenciaModal({
    abierto,
    onCerrar,
    onRegistrar,
    guardando,
    error
}) {
    const [busqueda, setBusqueda] = useState('');
    const [clientes, setClientes] = useState([]);
    const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
    const [cargandoClientes, setCargandoClientes] = useState(false);
    const [observaciones, setObservaciones] = useState('');
    const [errorBusqueda, setErrorBusqueda] = useState('');

    useEffect(() => {
        if (!abierto) return undefined;

        const temporizador = setTimeout(async () => {
            setCargandoClientes(true);
            setErrorBusqueda('');

            try {
                const respuesta = await clientesServicio.listar({
                    pagina: 1,
                    limite: 10,
                    buscar: busqueda.trim(),
                    estado: 'activo'
                });

                setClientes(respuesta.data ?? []);
            } catch (error) {
                setClientes([]);
                setErrorBusqueda(
                    error.response?.data?.message ||
                    'No se pudieron buscar los clientes.'
                );
            } finally {
                setCargandoClientes(false);
            }
        }, 300);

        return () => clearTimeout(temporizador);
    }, [abierto, busqueda]);

    useEffect(() => {
        if (!abierto) {
            setBusqueda('');
            setClientes([]);
            setClienteSeleccionado(null);
            setObservaciones('');
            setErrorBusqueda('');
        }
    }, [abierto]);

    if (!abierto) return null;

    const seleccionarCliente = (cliente) => {
        setClienteSeleccionado(cliente);
        setBusqueda(`${cliente.nombre} ${cliente.apellido}`);
        setClientes([]);
    };

    const limpiarSeleccion = () => {
        setClienteSeleccionado(null);
        setBusqueda('');
    };

    const manejarEnvio = (evento) => {
        evento.preventDefault();

        if (!clienteSeleccionado || guardando) return;

        onRegistrar({
            cliente_id: clienteSeleccionado.id,
            observaciones: observaciones.trim() || undefined
        });
    };

    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(evento) => {
                if (evento.target === evento.currentTarget && !guardando) {
                    onCerrar();
                }
            }}
        >
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="titulo-modal-asistencia"
                className="w-full max-w-lg rounded-2xl bg-white shadow-xl"
            >
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                    <div>
                        <h2
                            id="titulo-modal-asistencia"
                            className="text-lg font-bold text-slate-900"
                        >
                            Registrar ingreso
                        </h2>

                        <p className="mt-1 text-sm text-slate-500">
                            Seleccioná el cliente que ingresa al gimnasio.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onCerrar}
                        disabled={guardando}
                        className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-50"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={manejarEnvio} className="space-y-5 p-6">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                            Cliente
                        </label>

                        <div className="relative">
                            <Search
                                size={18}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />

                            <input
                                type="search"
                                value={busqueda}
                                onChange={(evento) => {
                                    setBusqueda(evento.target.value);
                                    setClienteSeleccionado(null);
                                }}
                                placeholder="Buscar por nombre, documento o email..."
                                disabled={guardando}
                                autoComplete="off"
                                className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {cargandoClientes && (
                            <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                                <LoaderCircle size={14} className="animate-spin" />
                                Buscando clientes...
                            </p>
                        )}

                        {errorBusqueda && (
                            <p className="mt-2 text-xs text-red-600">
                                {errorBusqueda}
                            </p>
                        )}

                        {clientes.length > 0 && !clienteSeleccionado && (
                            <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                                {clientes.map((cliente) => (
                                    <button
                                        key={cliente.id}
                                        type="button"
                                        onClick={() => seleccionarCliente(cliente)}
                                        className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
                                    >
                                        <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                                            <UserRound size={17} />
                                        </div>

                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-slate-800">
                                                {cliente.nombre} {cliente.apellido}
                                            </p>

                                            <p className="truncate text-xs text-slate-500">
                                                {cliente.documento || cliente.email || 'Sin documento ni email'}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        {busqueda.trim().length >= 2 &&
                            !cargandoClientes &&
                            !errorBusqueda &&
                            clientes.length === 0 &&
                            !clienteSeleccionado && (
                                <p className="mt-2 text-xs text-slate-500">
                                    No se encontraron clientes activos.
                                </p>
                            )}
                    </div>

                    {clienteSeleccionado && (
                        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                            <div>
                                <p className="text-xs font-medium text-emerald-700">
                                    Cliente seleccionado
                                </p>

                                <p className="mt-1 font-semibold text-emerald-900">
                                    {clienteSeleccionado.nombre}{' '}
                                    {clienteSeleccionado.apellido}
                                </p>

                                <p className="mt-1 text-xs text-emerald-700">
                                    Se comprobará automáticamente su membresía vigente.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={limpiarSeleccion}
                                disabled={guardando}
                                className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-100"
                                aria-label="Cambiar cliente"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    )}

                    <div>
                        <label
                            htmlFor="observaciones-asistencia"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Observaciones (opcional)
                        </label>

                        <textarea
                            id="observaciones-asistencia"
                            value={observaciones}
                            onChange={(evento) => setObservaciones(evento.target.value)}
                            maxLength={250}
                            rows={3}
                            disabled={guardando}
                            placeholder="Observaciones sobre el ingreso..."
                            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />

                        <p className="mt-1 text-right text-xs text-slate-400">
                            {observaciones.length}/250
                        </p>
                    </div>

                    {error && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                            <p className="text-sm text-red-700">
                                {error}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                        <button
                            type="button"
                            onClick={onCerrar}
                            disabled={guardando}
                            className="rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={!clienteSeleccionado || guardando}
                            className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {guardando ? (
                                <LoaderCircle size={17} className="animate-spin" />
                            ) : (
                                <CalendarCheck size={17} />
                            )}

                            Registrar ingreso
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}

export default RegistrarAsistenciaModal;