import { Router } from 'express';

import {
    estaAutenticado,
    requierePermiso
} from '../../middleware/autenticacion.middleware.js';

import {
    verificarOrigen,
    verificarCsrf
} from '../../middleware/csrf.middleware.js';

import {
    listarReservas,
    crearReserva,
    cancelarReserva,
    actualizarAsistencia
} from './clases.controller.js';

const router = Router();

/* Verifico la autenticación antes de permitir el acceso a las reservas. */
router.use(estaAutenticado);

/* Consulto las reservas respetando los permisos del usuario autenticado. */
router.get(
    '/',
    requierePermiso('reservas.consultar'),
    listarReservas
);

/* Protejo las operaciones de escritura contra solicitudes no autorizadas. */
router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('reservas.crear'),
    crearReserva
);

router.patch(
    '/:id/cancelar',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('reservas.cancelar'),
    cancelarReserva
);

router.patch(
    '/:id/asistencia',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('reservas.gestionar'),
    actualizarAsistencia
);

export default router;