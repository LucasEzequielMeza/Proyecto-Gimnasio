import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RutaProtegida() {
    const { autenticado, cargando } = useAuth();

    if (cargando) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p className="text-sm text-slate-500">
                    Verificando sesión...
                </p>
            </div>
        );
    }

    if (!autenticado) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
}

export default RutaProtegida;