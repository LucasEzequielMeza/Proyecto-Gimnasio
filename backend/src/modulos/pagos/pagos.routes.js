import { Router } from 'express';

import {
    listarPagos,
    obtenerPago,
    crearPago
} from './pagos.controller.js';

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