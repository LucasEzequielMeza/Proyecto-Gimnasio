import { useEffect, useState } from 'react';
import { Save, Info } from 'lucide-react';

import clientesServicio from '../../clientes/services/clientesServicio';
import planesServicio from '../../planes/services/planesServicio';

function obtenerFechaActual() {
    const fecha = new Date();
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${anio}-${mes}-${dia}`;
}

function MembresiaForm({ valoresIniciales, onSubmit, guardando, textoBoton, modoEdicion = false }) {
    const [formulario, setFormulario] = useState({
        cliente_id: '',
        plan_id: '',
        fecha_inicio: obtenerFechaActual()
    });
    const [clientes, setClientes] = useState([]);
    const [planes, setPlanes] = useState([]);
    const [cargandoDatos, setCargandoDatos] = useState(!modoEdicion);
    const [erroresCampos, setErroresCampos] = useState({});
    const [errorGeneral, setErrorGeneral] = useState('');

    useEffect(() => {
        if (valoresIniciales) {
            setFormulario({
                cliente_id: valoresIniciales.cliente_id ?? '',
                plan_id: valoresIniciales.plan_id ?? '',
                fecha_inicio: valoresIniciales.fecha_inicio?.slice(0, 10) ?? obtenerFechaActual()
            });
        }
    }, [valoresIniciales]);

    useEffect(() => {
        if (modoEdicion) return;

        async function cargarDatos() {
            try {
                setCargandoDatos(true);

                const [respuestaClientes, respuestaPlanes] = await Promise.all([
                    clientesServicio.listar({ pagina: 1, limite: 100, estado: 'activo' }),
                    planesServicio.listar({ pagina: 1, limite: 100, estado: 'activo' })
                ]);

                setClientes(respuestaClientes.data || []);
                setPlanes(respuestaPlanes.data || []);
            } catch (error) {
                setErrorGeneral(
                    error.response?.data?.message ||
                    'No se pudieron cargar los clientes y planes disponibles.'
                );
            } finally {
                setCargandoDatos(false);
            }
        }

        cargarDatos();
    }, [modoEdicion]);

    function manejarCambio(evento) {
        const { name, value } = evento.target;

        setFormulario((actual) => ({
            ...actual,
            [name]: value
        }));

        setErroresCampos((actual) => ({
            ...actual,
            [name]: undefined
        }));

        setErrorGeneral('');
    }

    function obtenerMensajeError(campo) {
        const error = erroresCampos[campo];

        if (!error) return null;

        return Array.isArray(error) ? error[0] : error;
    }

    async function manejarEnvio(evento) {
        evento.preventDefault();
        setErroresCampos({});
        setErrorGeneral('');

        const errores = {};

        if (!modoEdicion && !formulario.cliente_id) {
            errores.cliente_id = ['Seleccioná un cliente'];
        }

        if (!modoEdicion && !formulario.plan_id) {
            errores.plan_id = ['Seleccioná un plan'];
        }

        if (!formulario.fecha_inicio) {
            errores.fecha_inicio = ['La fecha de inicio es obligatoria'];
        } else if (formulario.fecha_inicio > obtenerFechaActual()) {
            errores.fecha_inicio = ['La fecha de inicio no puede ser futura'];
        }

        if (Object.keys(errores).length > 0) {
            setErroresCampos(errores);
            return;
        }

        const datos = modoEdicion
            ? { fecha_inicio: formulario.fecha_inicio }
            : {
                cliente_id: formulario.cliente_id,
                plan_id: formulario.plan_id,
                fecha_inicio: formulario.fecha_inicio
            };

        try {
            await onSubmit(datos);
        } catch (error) {
            const respuesta = error.response?.data;
            const erroresServidor = {};

            if (Array.isArray(respuesta?.errores)) {
                respuesta.errores.forEach((item) => {
                    const campo = Array.isArray(item.path) ? item.path.join('.') : item.campo;
                    const mensaje = item.message || item.mensaje;

                    if (campo && mensaje) {
                        erroresServidor[campo] = [
                            ...(erroresServidor[campo] || []),
                            mensaje
                        ];
                    }
                });
            }

            if (Object.keys(erroresServidor).length > 0) {
                setErroresCampos(erroresServidor);
            } else {
                setErrorGeneral(
                    respuesta?.message ||
                    'No se pudieron guardar los datos de la membresía.'
                );
            }
        }
    }

    function campoFecha() {
        const mensajeError = obtenerMensajeError('fecha_inicio');

        return (
            <div>
                <label htmlFor="fecha_inicio" className="mb-1.5 block text-sm font-medium text-slate-700">
                    Fecha de inicio <span className="text-red-500">*</span>
                </label>
                <input
                    id="fecha_inicio"
                    name="fecha_inicio"
                    type="date"
                    value={formulario.fecha_inicio}
                    onChange={manejarCambio}
                    max={obtenerFechaActual()}
                    required
                    aria-invalid={Boolean(mensajeError)}
                    className={`w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 ${
                        mensajeError
                            ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                            : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
                    }`}
                />
                {mensajeError && <p className="mt-1 text-sm text-red-600">{mensajeError}</p>}
            </div>
        );
    }

    if (cargandoDatos) {
        return <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">Cargando datos...</div>;
    }

    return (
        <form onSubmit={manejarEnvio} className="space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-lg font-semibold text-slate-800">
                    {modoEdicion ? 'Modificar membresía' : 'Datos de la contratación'}
                </h2>

                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {!modoEdicion && (
                        <>
                            <div>
                                <label htmlFor="cliente_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Cliente <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="cliente_id"
                                    name="cliente_id"
                                    value={formulario.cliente_id}
                                    onChange={manejarCambio}
                                    required
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">Seleccionar cliente</option>
                                    {clientes.map((cliente) => (
                                        <option key={cliente.id} value={cliente.id}>
                                            {cliente.nombre} {cliente.apellido}
                                        </option>
                                    ))}
                                </select>
                                {obtenerMensajeError('cliente_id') && (
                                    <p className="mt-1 text-sm text-red-600">{obtenerMensajeError('cliente_id')}</p>
                                )}
                                {clientes.length === 0 && (
                                    <p className="mt-1 text-xs text-amber-700">No hay clientes activos disponibles.</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="plan_id" className="mb-1.5 block text-sm font-medium text-slate-700">
                                    Plan <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="plan_id"
                                    name="plan_id"
                                    value={formulario.plan_id}
                                    onChange={manejarCambio}
                                    required
                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                >
                                    <option value="">Seleccionar plan</option>
                                    {planes.map((plan) => (
                                        <option key={plan.id} value={plan.id}>
                                            {plan.nombre} — {new Intl.NumberFormat('es-AR', {
                                                style: 'currency',
                                                currency: 'ARS',
                                                maximumFractionDigits: 0
                                            }).format(Number(plan.precio))}
                                        </option>
                                    ))}
                                </select>
                                {obtenerMensajeError('plan_id') && (
                                    <p className="mt-1 text-sm text-red-600">{obtenerMensajeError('plan_id')}</p>
                                )}
                                {planes.length === 0 && (
                                    <p className="mt-1 text-xs text-amber-700">No hay planes activos disponibles.</p>
                                )}
                            </div>
                        </>
                    )}

                    {campoFecha()}
                </div>

                {!modoEdicion && (
                    <div className="mt-5 flex items-start gap-2 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
                        <Info size={17} className="mt-0.5 shrink-0" />
                        El precio, la moneda, el tipo y la duración se obtienen del plan seleccionado y quedan registrados en la membresía.
                    </div>
                )}

                {modoEdicion && (
                    <div className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Al modificar la fecha de inicio también se recalculará la fecha de finalización según las condiciones originales del plan.
                    </div>
                )}
            </section>

            {errorGeneral && (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorGeneral}
                </div>
            )}

            <div className="flex justify-end">
                <button
                    type="submit"
                    disabled={guardando || (!modoEdicion && (clientes.length === 0 || planes.length === 0))}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <Save size={17} />
                    {guardando ? 'Guardando...' : textoBoton}
                </button>
            </div>
        </form>
    );
}

export default MembresiaForm;