import { Navigate, Route, Routes } from 'react-router-dom';

import LoginPage from '../modules/auth/pages/LoginPage';
import DashboardPage from '../modules/dashboard/pages/Dashboard';

import UsuariosPage from '../modules/usuarios/pages/UsuariosPage';

import ClientesPage from '../modules/clientes/pages/ClientesPage';
import ClienteNuevoPage from '../modules/clientes/pages/ClienteNuevoPage';
import ClienteEditarPage from '../modules/clientes/pages/ClienteEditarPage';
import ClienteDetallePage from '../modules/clientes/pages/ClienteDetallePage';

import PlanesPage from '../modules/planes/pages/PlanesPage';
import PlanNuevoPage from '../modules/planes/pages/PlanNuevoPage';
import PlanEditarPage from '../modules/planes/pages/PlanEditarPage';

import MembresiasPage from '../modules/membresias/pages/MembresiasPage';
import MembresiaNuevaPage from '../modules/membresias/pages/MembresiaNuevaPage';
import MembresiaEditarPage from '../modules/membresias/pages/MembresiaEditarPage';
import MembresiaDetallePage from '../modules/membresias/pages/MembresiaDetallePage';

import PagosPage from '../modules/pagos/pages/PagosPage';
import ObligacionDetallePage from '../modules/pagos/pages/ObligacionDetallePage';

import AsistenciasPage from '../modules/asistencias/pages/AsistenciasPage';
import AsistenciaDetallePage from '../modules/asistencias/pages/AsistenciaDetallePage';

import MainLayout from '../layouts/MainLayout';
import RutaProtegida from './RutaProtegida';

function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<RutaProtegida />}>
                <Route element={<MainLayout />}>
                    <Route index element={<DashboardPage />} />

                    <Route path="/usuarios" element={<UsuariosPage />} />

                    <Route path="/clientes" element={<ClientesPage />} />
                    <Route path="/clientes/nuevo" element={<ClienteNuevoPage />} />
                    <Route path="/clientes/:id/editar" element={<ClienteEditarPage />} />
                    <Route path="/clientes/:id" element={<ClienteDetallePage />} />

                    <Route path="/planes" element={<PlanesPage />} />
                    <Route path="/planes/nuevo" element={<PlanNuevoPage />} />
                    <Route path="/planes/:id/editar" element={<PlanEditarPage />} />

                    <Route path="/membresias" element={<MembresiasPage />} />
                    <Route path="/membresias/nueva" element={<MembresiaNuevaPage />} />
                    <Route path="/membresias/:id/editar" element={<MembresiaEditarPage />} />
                    <Route path="/membresias/:id" element={<MembresiaDetallePage />} />

                    <Route path="/pagos" element={<PagosPage />} />
                    <Route path="/pagos/obligaciones/:id" element={<ObligacionDetallePage />}/>

                    <Route path="/asistencias" element={<AsistenciasPage />} />
                    <Route path="/asistencias/:id" element={<AsistenciaDetallePage />}
                    />
                </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default AppRouter;