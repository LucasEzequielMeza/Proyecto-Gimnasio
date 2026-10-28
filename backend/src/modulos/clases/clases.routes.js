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
    listarClases,
    crearClase,
    actualizarClase,
    listarSesiones,
    crearSesion,
    actualizarSesion
} from './clases.controller.js';

const router = Router();

/* Verifico la autenticación antes de permitir el acceso a las rutas de clases. */
router.use(estaAutenticado);

/* Consulto el catálogo de clases y las sesiones disponibles. */
router.get(
    '/',
    requierePermiso('clases.consultar'),
    listarClases
);

router.get(
    '/sesiones',
    requierePermiso('clases.consultar'),
    listarSesiones
);

/* Protejo las operaciones que modifican datos con las validaciones de origen y CSRF. */
router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clases.gestionar'),
    crearClase
);

router.patch(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clases.gestionar'),
    actualizarClase
);

router.post(
    '/sesiones',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clases.gestionar'),
    crearSesion
);

router.patch(
    '/sesiones/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clases.gestionar'),
    actualizarSesion
);

export default router;