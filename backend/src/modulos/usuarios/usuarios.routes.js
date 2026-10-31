import { Router } from 'express';

import {
    crearUsuario,
    listarUsuarios,
    obtenerUsuario,
    cambiarEstadoUsuario,
    cambiarRolesUsuario
} from './usuarios.controller.js';

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

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('usuarios.crear'),
    crearUsuario
);

router.get(
    '/',
    requierePermiso('usuarios.consultar'),
    listarUsuarios
);

router.get(
    '/:id',
    requierePermiso('usuarios.consultar'),
    obtenerUsuario
);

router.patch(
    '/:id/estado',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('usuarios.desactivar'),
    cambiarEstadoUsuario
);

router.put(
    '/:id/roles',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('roles.asignar'),
    cambiarRolesUsuario
);

export default router;