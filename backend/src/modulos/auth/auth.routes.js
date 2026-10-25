import { Router } from 'express';
import {
    registrar,
    iniciarSesion,
    cerrarSesion,
    obtenerSesion
} from './auth.controller.js';
import { validateSchema } from '../../middleware/validacion.middleware.js';
import {
    registroSchema,
    loginSchema
} from './auth.schemas.js';
import {
    limiteLogin,
    limiteRegistro
} from '../../middleware/limiteAutorizacion.middleware.js';
import { estaAutenticado } from '../../middleware/autenticacion.middleware.js';
import {
    verificarOrigen,
    verificarCsrf
} from '../../middleware/csrf.middleware.js';

const router = Router();

router.post(
    '/register',
    verificarOrigen,
    limiteRegistro,
    validateSchema(registroSchema),
    registrar
);

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

router.get('/perfil', estaAutenticado, obtenerSesion);

export default router;