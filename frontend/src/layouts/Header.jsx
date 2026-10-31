import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Menu,
    LogOut,
    UserCircle
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';

function Header({ onAbrirMenu }) {
    const navigate = useNavigate();
    const { usuario, cerrarSesion } = useAuth();

    const [cerrandoSesion, setCerrandoSesion] = useState(false);
    const [error, setError] = useState('');

    const manejarCierreSesion = async () => {
        setError('');
        setCerrandoSesion(true);

        try {
            await cerrarSesion();
            navigate('/login', { replace: true });
        } catch (error) {
            setError(
                error.response?.data?.message ||
                'No se pudo cerrar la sesión.'
            );
        } finally {
            setCerrandoSesion(false);
        }
    };

    const nombreUsuario = usuario
        ? `${usuario.nombre || ''} ${usuario.apellido || ''}`.trim()
        : 'Usuario';

    return (
        <header className="relative z-30 flex h-20 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onAbrirMenu}
                    className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                    aria-label="Abrir menú"
                >
                    <Menu size={23} />
                </button>

                <div>
                    <p className="text-sm font-semibold text-slate-800">
                        Panel de administración
                    </p>
                    <p className="hidden text-xs text-slate-500 sm:block">
                        Gestión de tu gimnasio
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
                <div className="hidden items-center gap-2 sm:flex">
                    <UserCircle size={30} className="text-slate-400" />

                    <div>
                        <p className="text-sm font-semibold text-slate-800">
                            {nombreUsuario}
                        </p>
                        <p className="text-xs text-slate-500">
                            {usuario?.email || ''}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={manejarCierreSesion}
                    disabled={cerrandoSesion}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                    <LogOut size={17} />
                    <span className="hidden sm:inline">
                        {cerrandoSesion ? 'Saliendo...' : 'Salir'}
                    </span>
                </button>
            </div>

            {error && (
                <p className="absolute right-4 top-full mt-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 shadow">
                    {error}
                </p>
            )}
        </header>
    );
}

export default Header;