import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import MembresiaForm from '../components/MembresiaForm';
import membresiasServicio from '../services/membresiasServicio';
import { useAuth } from '../../../context/AuthContext';

function MembresiaNuevaPage() {
    const navegar = useNavigate();
    const { csrfToken, usuario } = useAuth();

    const puedeCrear = usuario?.permisos?.includes('membresias.crear') ?? false;

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    if (!puedeCrear) {
        return <Navigate to="/membresias" replace />;
    }

    async function manejarEnvio(datos) {
        if (!puedeCrear || guardando) return;

        try {
            setGuardando(true);
            setError('');

            await membresiasServicio.crear(datos, csrfToken);

            navegar('/membresias', {
                replace: true,
                state: {
                    mensaje: 'La membresía se creó correctamente.'
                }
            });
        } catch (error) {
            setError(
                error.response?.data?.mensaje ||
                error.response?.data?.message ||
                'No se pudo crear la membresía.'
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navegar('/membresias')}
                    className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
                    aria-label="Volver"
                >
                    <ArrowLeft size={20} />
                </button>

                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Nueva membresía
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Registrá la contratación de un plan para un cliente.
                    </p>
                </div>
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            <MembresiaForm
                onSubmit={manejarEnvio}
                guardando={guardando}
                textoBoton="Crear membresía"
            />
        </div>
    );
}

export default MembresiaNuevaPage;