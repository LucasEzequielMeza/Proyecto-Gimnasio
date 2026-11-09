import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import planesServicio from '../services/planesServicio';
import PlanForm from '../components/PlanForm';
import { useAuth } from '../../../context/AuthContext';

function PlanEditarPage() {
    const { id } = useParams();
    const navegar = useNavigate();
    const { csrfToken, usuario } = useAuth();

    const puedeConsultar = usuario?.permisos?.includes('planes.consultar') ?? false;
    const puedeEditar = usuario?.permisos?.includes('planes.editar') ?? false;

    const [plan, setPlan] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [errorGeneral, setErrorGeneral] = useState('');

    const cargarPlan = useCallback(async () => {
        try {
            setCargando(true);
            setErrorGeneral('');

            const respuesta = await planesServicio.obtener(id);

            setPlan(respuesta.data);
        } catch (error) {
            setErrorGeneral(
                error.response?.data?.message ||
                'No se pudo cargar la información del plan.'
            );
        } finally {
            setCargando(false);
        }
    }, [id]);

    useEffect(() => {
        if (puedeConsultar && puedeEditar) {
            cargarPlan();
        }
    }, [cargarPlan, puedeConsultar, puedeEditar]);

    async function manejarEnvio(datos) {
        if (!puedeEditar || guardando) return;

        try {
            setGuardando(true);
            setErrorGeneral('');

            await planesServicio.editar(id, datos, csrfToken);

            navegar('/planes', {
                replace: true,
                state: {
                    mensaje: 'Plan actualizado correctamente'
                }
            });
        } catch (error) {
            setErrorGeneral(
                error.response?.data?.message ||
                'No se pudo actualizar el plan.'
            );
        } finally {
            setGuardando(false);
        }
    }

    if (!puedeConsultar) {
        navegar('/', { replace: true });
        return null;
    }

    if (!puedeEditar) {
        navegar('/planes', { replace: true });
        return null;
    }

    if (cargando) {
        return (
            <div className="py-12 text-center text-sm text-slate-500">
                Cargando información del plan...
            </div>
        );
    }

    if (errorGeneral || !plan) {
        return (
            <div className="space-y-4">
                <button
                    type="button"
                    onClick={() => navegar('/planes')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    <ArrowLeft size={17} />
                    Volver a planes
                </button>

                <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {errorGeneral || 'No se encontró el plan solicitado.'}
                </div>
            </div>
        );
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
                        Editar plan
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Modificá los datos de {plan.nombre}.
                    </p>
                </div>
            </div>

            <PlanForm
                valoresIniciales={plan}
                onSubmit={manejarEnvio}
                guardando={guardando}
                textoBoton="Guardar cambios"
                modoEdicion
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

export default PlanEditarPage;