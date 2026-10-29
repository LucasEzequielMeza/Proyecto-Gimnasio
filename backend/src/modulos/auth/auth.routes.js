import { Router } from 'express';
import {
    iniciarSesion,
    cerrarSesion,
    obtenerSesion
} from './auth.controller.js';
import { validateSchema } from '../../middleware/validacion.middleware.js';
import { loginSchema } from './auth.schemas.js';

import {
    limiteLogin
} from '../../middleware/limiteAutorizacion.middleware.js';

import {
    estaAutenticado
} from '../../middleware/autenticacion.middleware.js';

import {
    verificarOrigen,
    verificarCsrf
} from '../../middleware/csrf.middleware.js';

const router = Router();

router.post(
    '/login',
    verificarOrigen,
    limiteLogin,
    validateSchema(loginSchema),
    iniciarSesion
);

router.post(
    '/logout',
    verificarOrigen,
    estaAutenticado,
    verificarCsrf,
    cerrarSesion
);

router.get(
    '/perfil',
    estaAutenticado,
    obtenerSesion
);

export default router;