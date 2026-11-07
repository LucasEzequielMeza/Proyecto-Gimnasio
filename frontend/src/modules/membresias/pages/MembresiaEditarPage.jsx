import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import MembresiaForm from '../components/MembresiaForm';
import membresiasServicio from '../services/membresiasServicio';
import { useAuth } from '../../../context/AuthContext';

function MembresiaEditarPage() {
    const { id } = useParams();
    const navegar = useNavigate();
    const { csrfToken } = useAuth();

    const [membresia, setMembresia] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        async function obtenerMembresia() {
            try {
                setCargando(true);
                setError('');

                const respuesta = await membresiasServicio.obtener(id);

                if (respuesta.data.estado !== 'ACTIVA') {
                    navegar(`/membresias/${id}`, { replace: true });
                    return;
                }

                setMembresia(respuesta.data);
            } catch (error) {
                setError(error.response?.data?.message || 'No se pudo obtener la membresía.');
            } finally {
                setCargando(false);
            }
        }

        obtenerMembresia();
    }, [id, navegar]);

    async function manejarEnvio(datos) {
        try {
            setGuardando(true);
            await membresiasServicio.editar(id, datos, csrfToken);
            navegar(`/membresias/${id}`, {
                state: { mensaje: 'La membresía se actualizó correctamente.' }
            });
        } finally {
            setGuardando(false);
        }
    }

    if (cargando) {
        return <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-sm text-slate-500">Cargando membresía...</div>;
    }

    if (error || !membresia) {
        return (
            <div className="space-y-4">
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error || 'No se encontró la membresía.'}
                </div>
                <button type="button" onClick={() => navegar('/membresias')} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Volver a membresías
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => navegar(`/membresias/${id}`)} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" aria-label="Volver">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Editar membresía</h1>
                    <p className="mt-1 text-sm text-slate-500">Modificá la fecha de inicio de la membresía.</p>
                </div>
            </div>

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