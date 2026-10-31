import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Dumbbell } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';

function LoginPage() {
    const navigate = useNavigate();

    const { iniciarSesion, autenticado } = useAuth();

    const [datos, setDatos] = useState({
        email: '',
        password: ''
    });

    const [error, setError] = useState('');
    const [cargando, setCargando] = useState(false);

    if (autenticado) {
        return <Navigate to="/" replace />;
    }

    const manejarCambio = (e) => {
        setDatos({
            ...datos,
            [e.target.name]: e.target.value
        });
    };

    const manejarEnvio = async (e) => {
        e.preventDefault();

        setError('');
        setCargando(true);

        try {
            await iniciarSesion(datos);
            navigate('/', { replace: true });
        } catch (error) {
            setError(
                error.response?.data?.message ||
                'No se pudo iniciar sesión.'
            );
        } finally {
            setCargando(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600 text-white">
                        <Dumbbell size={28} />
                    </div>

                    <h1 className="text-2xl font-bold text-slate-900">
                        ProyectoGym
                    </h1>

                    <p className="mt-2 text-sm text-slate-500">
                        Ingresá a tu cuenta para continuar
                    </p>
                </div>

                <form onSubmit={manejarEnvio} className="space-y-5">
                    <div>
                        <label
                            htmlFor="email"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Correo electrónico
                        </label>

                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="username"
                            required
                            value={datos.email}
                            onChange={manejarCambio}
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="correo@ejemplo.com"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="mb-2 block text-sm font-medium text-slate-700"
                        >
                            Contraseña
                        </label>

                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={datos.password}
                            onChange={manejarCambio}
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="Ingresá tu contraseña"
                        />
                    </div>

                    {error && (
                        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={cargando}
                        className="w-full rounded-lg bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {cargando ? 'Ingresando...' : 'Iniciar sesión'}
                    </button>
                </form>
            </section>
        </main>
    );
}

export default LoginPage;