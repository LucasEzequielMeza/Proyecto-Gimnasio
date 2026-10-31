import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../modules/auth/pages/LoginPage';
import RutaProtegida from './RutaProtegida';

function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RutaProtegida />}>
                <Route path="/" element={
                    <div className="p-8">
                        <h1 className="text-2xl font-bold">
                            ProyectoGym
                        </h1>
                        <p className="mt-2 text-slate-500">
                            Sesión iniciada correctamente.
                        </p>
                    </div>
                } />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRouter;