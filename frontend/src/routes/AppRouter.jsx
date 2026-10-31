import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../modules/auth/pages/LoginPage';
import DashboardPage from '../modules/dashboard/pages/Dashboard';

import MainLayout from '../layouts/MainLayout';
import RutaProtegida from './RutaProtegida';

function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RutaProtegida />}>
                <Route element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRouter;