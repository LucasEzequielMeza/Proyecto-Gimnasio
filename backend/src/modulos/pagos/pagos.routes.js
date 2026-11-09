import { Router } from 'express';

import {
    listarPagos,
    obtenerPago,
    crearPago
} from './pagos.controller.js';

import {
    listarObligaciones,
    obtenerObligacion,
    cancelarObligacion
} from './obligaciones.controller.js';

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

/* Gestión de obligaciones. */
router.get(
    '/obligaciones',
    requierePermiso('pagos.consultar'),
    listarObligaciones
);

router.get(
    '/obligaciones/:id',
    requierePermiso('pagos.consultar'),
    obtenerObligacion
);

router.patch(
    '/obligaciones/:id/cancelar',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('pagos.obligaciones.cancelar'),
    cancelarObligacion
);

/* Gestión de pagos. */
router.get(
    '/',
    requierePermiso('pagos.consultar'),
    listarPagos
);

router.get(
    '/:id',
    requierePermiso('pagos.consultar'),
    obtenerPago
);

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('pagos.registrar'),
    crearPago
);

export default router;