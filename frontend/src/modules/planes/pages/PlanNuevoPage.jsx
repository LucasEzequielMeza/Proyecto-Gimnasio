import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import planesServicio from '../services/planesServicio';
import PlanForm from '../components/PlanForm';
import { useAuth } from '../../../context/AuthContext';

function PlanNuevoPage() {
    const navegar = useNavigate();
    const { csrfToken, usuario } = useAuth();

    const puedeCrear = usuario?.permisos?.includes('planes.crear') ?? false;

    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    if (!puedeCrear) {
        navegar('/planes', { replace: true });
        return null;
    }

    async function manejarEnvio(datos) {
        if (!puedeCrear || guardando) return;

        try {
            setGuardando(true);
            setError('');

            const respuesta = await planesServicio.crear(datos, csrfToken);

            navegar('/planes', {
                replace: true,
                state: {
                    mensaje: respuesta.message || 'Plan creado correctamente'
                }
            });
        } catch (error) {
            setError(
                error.response?.data?.message ||
                'No se pudo crear el plan.'
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navegar('/planes')}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                    aria-label="Volver a planes"
                >
                    <ArrowLeft size={20} />
                </button>

                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Nuevo plan
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Completá los datos para crear un plan.
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

            <PlanForm
                onSubmit={manejarEnvio}
                guardando={guardando}
                textoBoton="Guardar plan"
            />

            <div className="flex justify-end">
                <button
                    type="button"
                    onClick={() => navegar('/planes')}
                    disabled={guardando}
                    className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                    Cancelar
                </button>
            </div>
        </div>
    );
}

export default PlanNuevoPage;