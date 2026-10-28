import { Router } from 'express';

import {
    listarRutinas,
    obtenerRutina,
    crearRutina,
    editarRutina,
    asignarRutina,
    cambiarEstadoRutina,
    eliminarRutina
} from './rutinas.controller.js';

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
    requierePermiso('rutinas.consultar'),
    listarRutinas
);

router.get(
    '/:id',
    requierePermiso('rutinas.consultar'),
    obtenerRutina
);

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('rutinas.crear'),
    crearRutina
);

router.put(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('rutinas.editar'),
    editarRutina
);

router.patch(
    '/:id/asignar',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('rutinas.asignar'),
    asignarRutina
);

router.patch(
    '/:id/estado',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('rutinas.editar'),
    cambiarEstadoRutina
);

router.delete(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('rutinas.eliminar'),
    eliminarRutina
);

export default router;