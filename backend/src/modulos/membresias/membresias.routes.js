import { Router } from 'express';

import {
    listarMembresias,
    obtenerMembresia,
    crearMembresia,
    editarMembresia,
    cambiarEstadoMembresia,
} from './membresias.controller.js';

import { estaAutenticado, requierePermiso } from '../../middleware/autenticacion.middleware.js';
import {
    verificarOrigen,
    verificarCsrf,
} from '../../middleware/csrf.middleware.js';

const router = Router();

router.use(estaAutenticado);

router.get(
    '/',
    requierePermiso('membresias.consultar'),
    listarMembresias
);

router.get(
    '/:id',
    requierePermiso('membresias.consultar'),
    obtenerMembresia
);

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('membresias.crear'),
    crearMembresia
);

router.patch(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('membresias.editar'),
    editarMembresia
);

router.patch(
    '/:id/estado',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('membresias.cancelar'),
    cambiarEstadoMembresia
);

export default router;