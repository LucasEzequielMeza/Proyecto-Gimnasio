import { Router } from 'express';

import {
    crearUsuario,
    listarUsuarios,
    obtenerUsuario,
    editarUsuario,
    listarRoles,
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

router.get(
    '/',
    requierePermiso('usuarios.consultar'),
    listarUsuarios
);

router.get(
    '/roles',
    requierePermiso('roles.consultar'),
    listarRoles
);

router.get(
    '/:id',
    requierePermiso('usuarios.consultar'),
    obtenerUsuario
);

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('usuarios.crear'),
    crearUsuario
);

router.patch(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('usuarios.editar'),
    editarUsuario
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