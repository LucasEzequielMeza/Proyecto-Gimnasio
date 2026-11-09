import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    UserRound,
    ClipboardList,
    CreditCard,
    CalendarCheck,
    Dumbbell,
    Bell,
    CalendarDays,
    X
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const opcionesMenu = [
    {
        nombre: 'Dashboard',
        ruta: '/',
        icono: LayoutDashboard
    },
    {
        nombre: 'Usuarios',
        ruta: '/usuarios',
        icono: Users,
        permiso: 'usuarios.consultar'
    },
    {
        nombre: 'Clientes',
        ruta: '/clientes',
        icono: UserRound,
        permiso: 'clientes.consultar'
    },
    {
        nombre: 'Planes',
        ruta: '/planes',
        icono: ClipboardList,
        permiso: 'planes.consultar'
    },
    {
        nombre: 'Membresías',
        ruta: '/membresias',
        icono: ClipboardList,
        permiso: 'membresias.consultar'
    },
    {
        nombre: 'Pagos',
        ruta: '/pagos',
        icono: CreditCard,
        permiso: 'pagos.consultar'
    },
    {
        nombre: 'Asistencias',
        ruta: '/asistencias',
        icono: CalendarCheck,
        permiso: 'asistencias.consultar'
    },
    {
        nombre: 'Rutinas',
        ruta: '/rutinas',
        icono: Dumbbell,
        permiso: 'rutinas.consultar'
    },
    {
        nombre: 'Notificaciones',
        ruta: '/notificaciones',
        icono: Bell,
        permiso: 'notificaciones.consultar'
    },
    {
        nombre: 'Clases y reservas',
        ruta: '/clases',
        icono: CalendarDays,
        permiso: 'clases.consultar'
    }
];

function Sidebar({ abierto, onCerrar }) {
    const { usuario } = useAuth();

    const permisos = usuario?.permisos ?? [];

    /* Muestro únicamente las opciones para las que el usuario tiene permiso de consulta. */
    const opcionesVisibles = opcionesMenu.filter((opcion) => {
        if (!opcion.permiso) return true;

        return permisos.includes(opcion.permiso);
    });

    return (
        <>
            {abierto && (
                <button
                    type="button"
                    aria-label="Cerrar menú"
                    onClick={onCerrar}
                    className="fixed inset-0 z-40 bg-black/50 lg:hidden"
                />
            )}

            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 flex w-72 flex-col
                    bg-slate-950 text-white transition-transform duration-300
                    lg:static lg:translate-x-0
                    ${abierto ? 'translate-x-0' : '-translate-x-full'}
                `}
            >
                <div className="flex h-20 items-center justify-between border-b border-white/10 px-6">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600">
                            <Dumbbell size={22} />
                        </div>

                        <div>
                            <h1 className="text-lg font-bold tracking-wide">
                                ProyectoGym
                            </h1>

                            <p className="text-xs text-slate-400">
                                Gestión integral
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/10 lg:hidden"
                        aria-label="Cerrar navegación"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
                    <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Menú principal
                    </p>

                    {opcionesVisibles.map((opcion) => {
                        const Icono = opcion.icono;

                        return (
                            <NavLink
                                key={opcion.ruta}
                                to={opcion.ruta}
                                end={opcion.ruta === '/'}
                                onClick={onCerrar}
                                className={({ isActive }) => `
                                    flex items-center gap-3 rounded-lg px-3 py-3
                                    text-sm font-medium transition-colors
                                    ${
                                        isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:bg-white/10 hover:text-white'
                                    }
                                `}
                            >
                                <Icono size={19} />
                                <span>{opcion.nombre}</span>
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="border-t border-white/10 p-5">
                    <p className="text-xs text-slate-500">
                        ProyectoGym
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                        Sistema de gestión
                    </p>
                </div>
            </aside>
        </>
    );
}

export default Sidebar;