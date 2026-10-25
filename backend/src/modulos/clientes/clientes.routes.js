import { Router } from 'express';

import {
    listarClientes,
    obtenerCliente,
    crearCliente,
    editarCliente,
    cambiarEstadoCliente
} from './clientes.controller.js';

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
    requierePermiso('clientes.consultar'),
    listarClientes
);

router.get(
    '/:id',
    requierePermiso('clientes.consultar'),
    obtenerCliente
);

router.post(
    '/',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clientes.crear'),
    crearCliente
);

router.patch(
    '/:id',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clientes.editar'),
    editarCliente
);

router.patch(
    '/:id/estado',
    verificarOrigen,
    verificarCsrf,
    requierePermiso('clientes.desactivar'),
    cambiarEstadoCliente
);

export default router;