import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import MembresiaForm from '../components/MembresiaForm';
import membresiasServicio from '../services/membresiasServicio';
import { useAuth } from '../../../context/AuthContext';

function MembresiaEditarPage() {
    const { id } = useParams();
    const navegar = useNavigate();
    const { csrfToken, usuario } = useAuth();

    const permisos = usuario?.permisos ?? [];
    const puedeEditar = permisos.includes('membresias.editar');

    const [membresia, setMembresia] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!puedeEditar) {
            setCargando(false);
            return;
        }

        let activo = true;

        async function cargarMembresia() {
            try {
                setCargando(true);
                setError('');

                const respuesta = await membresiasServicio.obtener(id);

                if (!activo) return;

                if (!respuesta.data || respuesta.data.estado !== 'ACTIVA') {
                    navegar(`/membresias/${id}`, { replace: true });
                    return;
                }

                setMembresia(respuesta.data);
            } catch (error) {
                if (!activo) return;

                setError(
                    error.response?.data?.mensaje ||
                    error.response?.data?.message ||
                    'No se pudo cargar la membresía.'
                );
            } finally {
                if (activo) {
                    setCargando(false);
                }
            }
        }

        cargarMembresia();

        return () => {
            activo = false;
        };
    }, [id, puedeEditar, navegar]);

    async function manejarEnvio(datos) {
        if (!puedeEditar || guardando) return;

        try {
            setGuardando(true);
            setError('');

            await membresiasServicio.editar(
                id,
                { fecha_inicio: datos.fecha_inicio },
                csrfToken
            );

            navegar(`/membresias/${id}`, {
                replace: true,
                state: {
                    mensaje: 'La membresía se actualizó correctamente.'
                }
            });
        } catch (error) {
            setError(
                error.response?.data?.mensaje ||
                error.response?.data?.message ||
                'No se pudieron guardar los cambios de la membresía.'
            );
        } finally {
            setGuardando(false);
        }
    }

    if (!puedeEditar) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="font-medium text-slate-800">
                    No tenés permiso para editar membresías.
                </p>

                <button
                    type="button"
                    onClick={() => navegar('/membresias')}
                    className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    Volver a membresías
                </button>
            </div>
        );
    }

    if (cargando) {
        return (
            <div className="py-12 text-center text-sm text-slate-500">
                Cargando información de la membresía...
            </div>
        );
    }

    if (error && !membresia) {
        return (
            <div className="space-y-4">
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>

                <button
                    type="button"
                    onClick={() => navegar('/membresias')}
                    className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                    <ArrowLeft size={17} />
                    Volver a membresías
                </button>
            </div>
        );
    }

    if (!membresia) {
        return null;
    }

    return (
        <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => navegar(`/membresias/${id}`)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                    aria-label="Volver al detalle"
                >
                    <ArrowLeft size={20} />
                </button>

                <div>
                    <h1 className="text-2xl font-bold text-slate-800">
                        Editar membresía
                    </h1>

                    <p className="mt-1 text-sm text-slate-500">
                        Modificá la fecha de inicio de la membresía.
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
                valoresIniciales={membresia}
                onSubmit={manejarEnvio}
                guardando={guardando}
                textoBoton="Guardar cambios"
                modoEdicion
            />
        </div>
    );
}

export default MembresiaEditarPage;