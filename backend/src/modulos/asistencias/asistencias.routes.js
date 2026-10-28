import { Router } from 'express';

import {
    listarAsistencias,
    obtenerAsistencia,
    registrarAsistencia
} from './asistencias.controller.js';

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
    requierePermiso('asistencias.consultar'),
    listarAsistencias
);

router.get(
    '/:id',
    requierePermiso('asistencias.consultar'),
    obtenerAsistencia
);

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('asistencias.registrar'),
    registrarAsistencia
);

export default router;