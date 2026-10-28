import { Router } from 'express';

import {
    listarNotificaciones,
    marcarNotificacionLeida,
    marcarTodasLeidas,
    eliminarNotificacion
} from './notificaciones.controller.js';

import {
    estaAutenticado,
    requierePermiso
} from '../../middleware/autenticacion.middleware.js';

import {
    verificarOrigen,
    verificarCsrf
} from '../../middleware/csrf.middleware.js';

const router = Router();

router.use(estaAutenticado);

router.get(
    '/',
    requierePermiso('notificaciones.consultar'),
    listarNotificaciones
);

router.patch(
    '/leidas/todas',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('notificaciones.gestionar'),
    marcarTodasLeidas
);

router.patch(
    '/:id/leida',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('notificaciones.gestionar'),
    marcarNotificacionLeida
);

router.delete(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('notificaciones.gestionar'),
    eliminarNotificacion
);

export default router;