import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../modules/auth/pages/LoginPage';
import DashboardPage from '../modules/dashboard/pages/Dashboard';
import ClientesPage from '../modules/clientes/pages/ClientesPage';
import ClienteNuevoPage from '../modules/clientes/pages/ClienteNuevoPage';
import ClienteEditarPage from '../modules/clientes/pages/ClienteEditarPage';
import ClienteDetallePage from '../modules/clientes/pages/ClienteDetallePage';

import MainLayout from '../layouts/MainLayout';
import RutaProtegida from './RutaProtegida';

function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RutaProtegida />}>
                <Route element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="/clientes" element={<ClientesPage />} />
                    <Route path="/clientes/nuevo" element={<ClienteNuevoPage />} />
                    <Route path="/clientes/:id/editar" element={<ClienteEditarPage />} />
                    <Route path="/clientes/:id" element={<ClienteDetallePage />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRouter;