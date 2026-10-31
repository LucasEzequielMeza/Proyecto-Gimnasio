import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import Sidebar from './Sidebar';
import Header from './Header';

function MainLayout() {
    const [menuAbierto, setMenuAbierto] = useState(false);

    const cerrarMenu = () => setMenuAbierto(false);

    return (
        <div className="flex min-h-screen bg-slate-50">
            <Sidebar
                abierto={menuAbierto}
                onCerrar={cerrarMenu}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <Header
                    onAbrirMenu={() => setMenuAbierto(true)}
                />

                <main className="flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default MainLayout;