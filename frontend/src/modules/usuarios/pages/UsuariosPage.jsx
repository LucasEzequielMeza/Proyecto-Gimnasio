import { useCallback, useEffect, useState } from 'react';
import {
    Plus,
    Search,
    RefreshCw,
    Pencil,
    ShieldCheck,
    UserCheck,
    UserX,
    X,
    ChevronLeft,
    ChevronRight,
    Save
} from 'lucide-react';

import usuariosServicio from '../services/usuariosServicio';
import { useAuth } from '../../../context/AuthContext';

const FORMULARIO_INICIAL = {
    nombre: '',
    apellido: '',
    email: '',
    password: '',
    roles: []
};

const ESTADOS = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'bloqueado', label: 'Bloqueado' }
];

function obtenerMensajeError(error, alternativo) {
    return (
        error.response?.data?.message ||
        error.response?.data?.mensaje ||
        alternativo
    );
}

function obtenerErroresBackend(respuesta) {
    const erroresBackend = {};

    if (Array.isArray(respuesta?.errores)) {
        respuesta.errores.forEach((item) => {
            if (item.campo) {
                erroresBackend[item.campo] = item.mensaje;
            }
        });
    }

    if (respuesta?.errors && typeof respuesta.errors === 'object') {
        Object.entries(respuesta.errors).forEach(([campo, mensaje]) => {
            erroresBackend[campo] = Array.isArray(mensaje)
                ? mensaje.join(', ')
                : mensaje;
        });
    }

    return erroresBackend;
}

function UsuariosPage() {
    const { usuario, csrfToken } = useAuth();

    const permisos = usuario?.permisos ?? [];
    const rolesUsuario = usuario?.roles ?? [];

    const esAdmin = rolesUsuario.includes('ADMIN');
    const esRecepcion = rolesUsuario.includes('RECEPCION');

    const puedeConsultar = permisos.includes('usuarios.consultar');
    const puedeCrear = permisos.includes('usuarios.crear');
    const puedeEditar = permisos.includes('usuarios.editar');
    const puedeCambiarEstado = permisos.includes('usuarios.desactivar');
    const puedeAsignarRoles = permisos.includes('roles.asignar');
    const puedeConsultarRoles = permisos.includes('roles.consultar');

    const [usuarios, setUsuarios] = useState([]);
    const [rolesDisponibles, setRolesDisponibles] = useState([]);

    const [busqueda, setBusqueda] = useState('');
    const [estadoFiltro, setEstadoFiltro] = useState('');
    const [pagina, setPagina] = useState(1);

    const [paginacion, setPaginacion] = useState({
        pagina: 1,
        limite: 20,
        total: 0,
        paginas: 0
    });

    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);

    const [error, setError] = useState('');
    const [mensaje, setMensaje] = useState('');

    const [modal, setModal] = useState(null);
    const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

    const [formulario, setFormulario] = useState(FORMULARIO_INICIAL);
    const [rolesSeleccionados, setRolesSeleccionados] = useState([]);

    const [errores, setErrores] = useState({});

    /*
     * Cargo los usuarios respetando los filtros y la paginación
     * que maneja el backend.
     */
    const cargarUsuarios = useCallback(async () => {
        if (!puedeConsultar) {
            setCargando(false);
            return;
        }

        setCargando(true);
        setError('');

        try {
            const respuesta = await usuariosServicio.listar({
                pagina,
                limite: 20,
                buscar: busqueda.trim(),
                ...(estadoFiltro ? { estado: estadoFiltro } : {})
            });

            setUsuarios(respuesta.data ?? []);

            setPaginacion(respuesta.paginacion ?? {
                pagina: 1,
                limite: 20,
                total: 0,
                paginas: 0
            });
        } catch (errorCarga) {
            setError(
                obtenerMensajeError(
                    errorCarga,
                    'No se pudieron cargar los usuarios.'
                )
            );
        } finally {
            setCargando(false);
        }
    }, [
        puedeConsultar,
        pagina,
        busqueda,
        estadoFiltro
    ]);

    /*
     * Cargo los roles que el backend permite consultar.
     * Para RECEPCION el backend devuelve únicamente CLIENTE.
     */
    const cargarRoles = useCallback(async () => {
        if (!puedeConsultarRoles) {
            setRolesDisponibles([]);
            return;
        }

        try {
            const respuesta = await usuariosServicio.listarRoles();

            setRolesDisponibles(respuesta.data ?? []);
        } catch (errorCarga) {
            setRolesDisponibles([]);

            setError(
                obtenerMensajeError(
                    errorCarga,
                    'No se pudieron cargar los roles disponibles.'
                )
            );
        }
    }, [puedeConsultarRoles]);

    useEffect(() => {
        const temporizador = setTimeout(() => {
            cargarUsuarios();
        }, 250);

        return () => clearTimeout(temporizador);
    }, [cargarUsuarios]);

    useEffect(() => {
        cargarRoles();
    }, [cargarRoles]);

    const abrirCrear = () => {
        setUsuarioSeleccionado(null);

        setFormulario({
            ...FORMULARIO_INICIAL,
            roles: esRecepcion ? ['CLIENTE'] : []
        });

        setErrores({});
        setError('');
        setMensaje('');
        setModal('crear');
    };

    const abrirEditar = (usuarioFila) => {
        setUsuarioSeleccionado(usuarioFila);

        setFormulario({
            nombre: usuarioFila.nombre ?? '',
            apellido: usuarioFila.apellido ?? '',
            email: usuarioFila.email ?? '',
            password: '',
            roles: []
        });

        setErrores({});
        setError('');
        setMensaje('');
        setModal('editar');
    };

    const abrirRoles = (usuarioFila) => {
        setUsuarioSeleccionado(usuarioFila);
        setRolesSeleccionados(usuarioFila.roles ?? []);

        setErrores({});
        setError('');
        setMensaje('');
        setModal('roles');
    };

    const cerrarModal = () => {
        if (guardando) return;

        setModal(null);
        setUsuarioSeleccionado(null);

        setFormulario(FORMULARIO_INICIAL);
        setRolesSeleccionados([]);

        setErrores({});
        setError('');
    };

    const manejarCambio = (evento) => {
        const { name, value } = evento.target;

        setFormulario((actual) => ({
            ...actual,
            [name]: value
        }));

        setErrores((actual) => ({
            ...actual,
            [name]: undefined
        }));
    };

    const alternarRol = (nombreRol) => {
        if (!esAdmin) return;

        setRolesSeleccionados((actuales) => (
            actuales.includes(nombreRol)
                ? actuales.filter((rol) => rol !== nombreRol)
                : [...actuales, nombreRol]
        ));

        setErrores((actual) => ({
            ...actual,
            roles: undefined
        }));
    };

    const manejarCambioRolesFormulario = (nombreRol) => {
        if (!esAdmin) return;

        setFormulario((actual) => ({
            ...actual,
            roles: actual.roles.includes(nombreRol)
                ? actual.roles.filter((rol) => rol !== nombreRol)
                : [...actual.roles, nombreRol]
        }));

        setErrores((actual) => ({
            ...actual,
            roles: undefined
        }));
    };

    const manejarEnvio = async (evento) => {
        evento.preventDefault();

        if (guardando) return;

        setError('');
        setMensaje('');
        setErrores({});

        /*
         * Proceso la actualización de roles por separado
         * porque utiliza un endpoint y una validación distintos.
         */
        if (modal === 'roles') {
            if (!puedeAsignarRoles || !esAdmin) {
                setError('No tenés permisos para administrar roles.');
                return;
            }

            if (rolesSeleccionados.length === 0) {
                setErrores({
                    roles: 'El usuario debe tener al menos un rol.'
                });

                return;
            }

            try {
                setGuardando(true);

                await usuariosServicio.cambiarRoles(
                    usuarioSeleccionado.id,
                    rolesSeleccionados,
                    csrfToken
                );

                setMensaje('Roles actualizados correctamente.');
                setModal(null);

                await cargarUsuarios();
            } catch (errorGuardar) {
                const erroresBackend = obtenerErroresBackend(
                    errorGuardar.response?.data
                );

                if (Object.keys(erroresBackend).length > 0) {
                    setErrores(erroresBackend);
                }

                setError(
                    obtenerMensajeError(
                        errorGuardar,
                        'No se pudieron actualizar los roles.'
                    )
                );
            } finally {
                setGuardando(false);
            }

            return;
        }

        const datos = {
            nombre: formulario.nombre.trim(),
            apellido: formulario.apellido.trim(),
            email: formulario.email.trim().toLowerCase()
        };

        const erroresLocales = {};

        if (datos.nombre.length < 2) {
            erroresLocales.nombre =
                'Ingresá un nombre de al menos 2 caracteres.';
        }

        if (datos.apellido.length < 2) {
            erroresLocales.apellido =
                'Ingresá un apellido de al menos 2 caracteres.';
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
            erroresLocales.email =
                'Ingresá un correo electrónico válido.';
        }

        if (modal === 'crear') {
            if (!puedeCrear) {
                setError('No tenés permisos para crear usuarios.');
                return;
            }

            if (formulario.password.length < 12) {
                erroresLocales.password =
                    'La contraseña debe tener al menos 12 caracteres.';
            }

            if (formulario.password.length > 72) {
                erroresLocales.password =
                    'La contraseña no puede superar los 72 caracteres.';
            }

            if (formulario.roles.length === 0) {
                erroresLocales.roles =
                    'Seleccioná al menos un rol.';
            }
        }

        if (Object.keys(erroresLocales).length > 0) {
            setErrores(erroresLocales);
            return;
        }

        try {
            setGuardando(true);

            if (modal === 'crear') {
                await usuariosServicio.crear(
                    {
                        ...datos,
                        password: formulario.password,
                        roles: esRecepcion
                            ? ['CLIENTE']
                            : formulario.roles
                    },
                    csrfToken
                );

                setMensaje('Usuario creado correctamente.');
            } else {
                await usuariosServicio.editar(
                    usuarioSeleccionado.id,
                    datos,
                    csrfToken
                );

                setMensaje(
                    'Datos del usuario actualizados correctamente.'
                );
            }

            setModal(null);
            setFormulario(FORMULARIO_INICIAL);

            await cargarUsuarios();
        } catch (errorGuardar) {
            const respuesta = errorGuardar.response?.data;

            const erroresBackend = obtenerErroresBackend(respuesta);

            if (Object.keys(erroresBackend).length > 0) {
                setErrores(erroresBackend);
            }

            setError(
                obtenerMensajeError(
                    errorGuardar,
                    'No se pudo guardar el usuario.'
                )
            );
        } finally {
            setGuardando(false);
        }
    };

    const manejarEstado = async (usuarioFila) => {
        if (!puedeCambiarEstado) return;

        const nuevoEstado = usuarioFila.estado === 'activo'
            ? 'inactivo'
            : 'activo';

        const confirmado = window.confirm(
            `¿Querés ${nuevoEstado === 'activo' ? 'activar' : 'desactivar'} a ${usuarioFila.nombre} ${usuarioFila.apellido}?`
        );

        if (!confirmado) return;

        setError('');
        setMensaje('');

        try {
            await usuariosServicio.cambiarEstado(
                usuarioFila.id,
                nuevoEstado,
                csrfToken
            );

            setMensaje(
                'Estado del usuario actualizado correctamente.'
            );

            await cargarUsuarios();
        } catch (errorEstado) {
            setError(
                obtenerMensajeError(
                    errorEstado,
                    'No se pudo actualizar el estado del usuario.'
                )
            );
        }
    };

    if (!puedeConsultar) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-800">
                    No tenés permiso para consultar usuarios.
                </p>
            </div>
        );
    }

    const totalPaginas = Math.max(paginacion.paginas || 1, 1);

    const puedeMostrarNuevoUsuario = puedeCrear && (
        esAdmin || esRecepcion
    );

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Usuarios
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Administrá las cuentas, sus roles y su estado de acceso.
                    </p>
                </div>

                {puedeMostrarNuevoUsuario && (
                    <button
                        type="button"
                        onClick={abrirCrear}
                        disabled={
                            !puedeConsultarRoles ||
                            rolesDisponibles.length === 0
                        }
                        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Plus size={18} />
                        Nuevo usuario
                    </button>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                        Usuarios encontrados
                    </p>

                    <p className="mt-3 text-3xl font-bold text-slate-900">
                        {cargando ? '—' : paginacion.total}
                    </p>
                </article>

                <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                        Página actual
                    </p>

                    <p className="mt-3 text-3xl font-bold text-slate-900">
                        {cargando
                            ? '—'
                            : `${paginacion.pagina} / ${totalPaginas}`}
                    </p>
                </article>
            </div>

            {mensaje && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {mensaje}
                </div>
            )}

            {error && !modal && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row">
                    <div className="relative flex-1">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                        />

                        <input
                            type="search"
                            value={busqueda}
                            onChange={(evento) => {
                                setBusqueda(evento.target.value);
                                setPagina(1);
                            }}
                            placeholder="Buscar por nombre, apellido o email..."
                            className="w-full rounded-lg border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                    </div>

                    <select
                        value={estadoFiltro}
                        onChange={(evento) => {
                            setEstadoFiltro(evento.target.value);
                            setPagina(1);
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-600 outline-none focus:border-blue-500"
                    >
                        <option value="">Todos los estados</option>

                        {ESTADOS.map((estado) => (
                            <option
                                key={estado.value}
                                value={estado.value}
                            >
                                {estado.label}
                            </option>
                        ))}
                    </select>

                    <button
                        type="button"
                        onClick={cargarUsuarios}
                        disabled={cargando}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                        <RefreshCw size={16} />
                        Actualizar
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[850px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-5 py-4 font-semibold">
                                    Usuario
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    Roles
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    Estado
                                </th>

                                <th className="px-5 py-4 font-semibold">
                                    Alta
                                </th>

                                <th className="px-5 py-4 text-right font-semibold">
                                    Acciones
                                </th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                            {cargando ? (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className="px-5 py-12 text-center text-slate-500"
                                    >
                                        Cargando usuarios...
                                    </td>
                                </tr>
                            ) : usuarios.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className="px-5 py-12 text-center text-slate-500"
                                    >
                                        No se encontraron usuarios.
                                    </td>
                                </tr>
                            ) : usuarios.map((usuarioFila) => (
                                <tr
                                    key={usuarioFila.id}
                                    className="hover:bg-slate-50"
                                >
                                    <td className="px-5 py-4">
                                        <p className="font-semibold text-slate-800">
                                            {usuarioFila.nombre} {usuarioFila.apellido}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                            {usuarioFila.email}
                                        </p>
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex flex-wrap gap-1.5">
                                            {(usuarioFila.roles ?? []).map((rol) => (
                                                <span
                                                    key={rol}
                                                    className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                                                >
                                                    {rol}
                                                </span>
                                            ))}
                                        </div>
                                    </td>

                                    <td className="px-5 py-4">
                                        <span
                                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                usuarioFila.estado === 'activo'
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : usuarioFila.estado === 'bloqueado'
                                                        ? 'bg-red-50 text-red-700'
                                                        : 'bg-amber-50 text-amber-700'
                                            }`}
                                        >
                                            {usuarioFila.estado}
                                        </span>
                                    </td>

                                    <td className="px-5 py-4 text-slate-500">
                                        {usuarioFila.creado_at
                                            ? new Date(
                                                usuarioFila.creado_at
                                            ).toLocaleDateString('es-AR')
                                            : '—'}
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-1.5">
                                            {puedeEditar && esAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => abrirEditar(usuarioFila)}
                                                    title="Editar datos"
                                                    aria-label={`Editar ${usuarioFila.nombre}`}
                                                    className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                                                >
                                                    <Pencil size={17} />
                                                </button>
                                            )}

                                            {puedeAsignarRoles &&
                                                puedeConsultarRoles &&
                                                esAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => abrirRoles(usuarioFila)}
                                                        title="Administrar roles"
                                                        aria-label={`Administrar roles de ${usuarioFila.nombre}`}
                                                        className="rounded-lg p-2 text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                                                    >
                                                        <ShieldCheck size={17} />
                                                    </button>
                                                )}

                                            {puedeCambiarEstado && esAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => manejarEstado(usuarioFila)}
                                                    title={
                                                        usuarioFila.estado === 'activo'
                                                            ? 'Desactivar usuario'
                                                            : 'Activar usuario'
                                                    }
                                                    aria-label={
                                                        usuarioFila.estado === 'activo'
                                                            ? 'Desactivar usuario'
                                                            : 'Activar usuario'
                                                    }
                                                    className="rounded-lg p-2 text-slate-500 hover:bg-amber-50 hover:text-amber-700"
                                                >
                                                    {usuarioFila.estado === 'activo'
                                                        ? <UserX size={17} />
                                                        : <UserCheck size={17} />}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                        Mostrando {usuarios.length} de {paginacion.total} usuarios
                    </p>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled={pagina <= 1 || cargando}
                            onClick={() => setPagina((actual) => actual - 1)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="Página anterior"
                        >
                            <ChevronLeft size={18} />
                        </button>

                        <span className="px-2 text-sm font-medium text-slate-700">
                            {pagina}
                        </span>

                        <button
                            type="button"
                            disabled={
                                pagina >= totalPaginas ||
                                cargando
                            }
                            onClick={() => setPagina((actual) => actual + 1)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            aria-label="Página siguiente"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </section>

            {modal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
                    <div className="my-8 w-full max-w-xl rounded-2xl bg-white shadow-xl">
                        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {modal === 'crear'
                                        ? 'Nuevo usuario'
                                        : modal === 'editar'
                                            ? 'Editar usuario'
                                            : 'Administrar roles'}
                                </h2>

                                <p className="mt-1 text-sm text-slate-500">
                                    {modal === 'roles' && usuarioSeleccionado
                                        ? `${usuarioSeleccionado.nombre} ${usuarioSeleccionado.apellido}`
                                        : 'Completá la información solicitada.'}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={cerrarModal}
                                disabled={guardando}
                                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                                aria-label="Cerrar"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form
                            onSubmit={manejarEnvio}
                            className="space-y-5 p-6"
                        >
                            {modal !== 'roles' ? (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div>
                                            <label
                                                className="mb-1.5 block text-sm font-medium text-slate-700"
                                                htmlFor="nombre"
                                            >
                                                Nombre
                                            </label>

                                            <input
                                                id="nombre"
                                                name="nombre"
                                                value={formulario.nombre}
                                                onChange={manejarCambio}
                                                required
                                                maxLength={100}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />

                                            {errores.nombre && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errores.nombre}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label
                                                className="mb-1.5 block text-sm font-medium text-slate-700"
                                                htmlFor="apellido"
                                            >
                                                Apellido
                                            </label>

                                            <input
                                                id="apellido"
                                                name="apellido"
                                                value={formulario.apellido}
                                                onChange={manejarCambio}
                                                required
                                                maxLength={100}
                                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                            />

                                            {errores.apellido && (
                                                <p className="mt-1 text-xs text-red-600">
                                                    {errores.apellido}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label
                                            className="mb-1.5 block text-sm font-medium text-slate-700"
                                            htmlFor="email"
                                        >
                                            Correo electrónico
                                        </label>

                                        <input
                                            id="email"
                                            name="email"
                                            type="email"
                                            value={formulario.email}
                                            onChange={manejarCambio}
                                            required
                                            maxLength={254}
                                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />

                                        {errores.email && (
                                            <p className="mt-1 text-xs text-red-600">
                                                {errores.email}
                                            </p>
                                        )}
                                    </div>

                                    {modal === 'crear' && (
                                        <>
                                            <div>
                                                <label
                                                    className="mb-1.5 block text-sm font-medium text-slate-700"
                                                    htmlFor="password"
                                                >
                                                    Contraseña inicial
                                                </label>

                                                <input
                                                    id="password"
                                                    name="password"
                                                    type="password"
                                                    value={formulario.password}
                                                    onChange={manejarCambio}
                                                    required
                                                    minLength={12}
                                                    maxLength={72}
                                                    autoComplete="new-password"
                                                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                />

                                                <p className="mt-1 text-xs text-slate-500">
                                                    Mínimo 12 caracteres.
                                                </p>

                                                {errores.password && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {errores.password}
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <p className="mb-2 text-sm font-medium text-slate-700">
                                                    Roles
                                                </p>

                                                {esRecepcion ? (
                                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                                        <div className="flex items-center gap-2">
                                                            <ShieldCheck
                                                                size={18}
                                                                className="text-blue-600"
                                                            />

                                                            <span className="text-sm font-semibold text-blue-800">
                                                                CLIENTE
                                                            </span>
                                                        </div>

                                                        <p className="mt-1 text-xs text-blue-700">
                                                            Las cuentas creadas desde recepción reciben exclusivamente el rol CLIENTE.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                        {rolesDisponibles.map((rol) => (
                                                            <label
                                                                key={rol.nombre}
                                                                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formulario.roles.includes(rol.nombre)}
                                                                    onChange={() => manejarCambioRolesFormulario(rol.nombre)}
                                                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                                />

                                                                <span>
                                                                    <span className="block text-sm font-medium text-slate-800">
                                                                        {rol.nombre}
                                                                    </span>

                                                                    {rol.descripcion && (
                                                                        <span className="mt-0.5 block text-xs text-slate-500">
                                                                            {rol.descripcion}
                                                                        </span>
                                                                    )}
                                                                </span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}

                                                {errores.roles && (
                                                    <p className="mt-1 text-xs text-red-600">
                                                        {errores.roles}
                                                    </p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </>
                            ) : (
                                <div>
                                    <p className="mb-3 text-sm text-slate-600">
                                        Seleccioná uno o más roles. Los permisos efectivos se combinan entre todos los roles asignados.
                                    </p>

                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {rolesDisponibles.map((rol) => (
                                            <label
                                                key={rol.nombre}
                                                className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 hover:bg-slate-50"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={rolesSeleccionados.includes(rol.nombre)}
                                                    onChange={() => alternarRol(rol.nombre)}
                                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                                />

                                                <span>
                                                    <span className="block text-sm font-medium text-slate-800">
                                                        {rol.nombre}
                                                    </span>

                                                    {rol.descripcion && (
                                                        <span className="mt-0.5 block text-xs text-slate-500">
                                                            {rol.descripcion}
                                                        </span>
                                                    )}
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    {errores.roles && (
                                        <p className="mt-2 text-xs text-red-600">
                                            {errores.roles}
                                        </p>
                                    )}
                                </div>
                            )}

                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={cerrarModal}
                                    disabled={guardando}
                                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="submit"
                                    disabled={guardando}
                                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Save size={16} />

                                    {guardando
                                        ? 'Guardando...'
                                        : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default UsuariosPage;