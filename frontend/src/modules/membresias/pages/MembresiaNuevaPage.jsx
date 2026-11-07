import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import MembresiaForm from '../components/MembresiaForm';
import membresiasServicio from '../services/membresiasServicio';
import { useAuth } from '../../../context/AuthContext';

function MembresiaNuevaPage() {
    const navegar = useNavigate();
    const { csrfToken } = useAuth();
    const [guardando, setGuardando] = useState(false);

    async function manejarEnvio(datos) {
        try {
            setGuardando(true);
            await membresiasServicio.crear(datos, csrfToken);
            navegar('/membresias', {
                state: { mensaje: 'La membresía se creó correctamente.' }
            });
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <button type="button" onClick={() => navegar('/membresias')} className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100" aria-label="Volver">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Nueva membresía</h1>
                    <p className="mt-1 text-sm text-slate-500">Registrá la contratación de un plan para un cliente.</p>
                </div>
            </div>

            <MembresiaForm
                onSubmit={manejarEnvio}
                guardando={guardando}
                textoBoton="Crear membresía"
            />
        </div>
    );
}

export default MembresiaNuevaPage;