import { Router } from 'express';

import {
    listarPlanes,
    obtenerPlan,
    crearPlan,
    editarPlan,
    cambiarEstadoPlan
} from './planes.controller.js';

import {
    estaAutenticado,
    requierePermiso
} from '../../middleware/autenticacion.middleware.js';

import {
    verificarOrigen,
    verificarCsrf
} from '../../middleware/csrf.middleware.js';

const router = Router();

// Todas las rutas requieren autenticación.
router.use(estaAutenticado);

// Consultar planes.
router.get(
    '/',
    requierePermiso('planes.consultar'),
    listarPlanes
);

router.get(
    '/:id',
    requierePermiso('planes.consultar'),
    obtenerPlan
);

// Crear plan.
router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('planes.crear'),
    crearPlan
);

// Editar plan.
router.patch(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('planes.editar'),
    editarPlan
);

// Activar o desactivar plan.
router.patch(
    '/:id/estado',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('planes.desactivar'),
    cambiarEstadoPlan
);

export default router;