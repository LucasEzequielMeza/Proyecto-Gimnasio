import api from '../../../api/axios';

const RUTA_MEMBRESIAS = '/membresias';

const membresiasServicio = {
    async listar(filtros = {}) {
        const respuesta = await api.get(RUTA_MEMBRESIAS, {
            params: filtros
        });

        return respuesta.data;
    },

    async obtener(id) {
        const respuesta = await api.get(`${RUTA_MEMBRESIAS}/${id}`);
        return respuesta.data;
    },

    async crear(datos, csrfToken) {
        const respuesta = await api.post(RUTA_MEMBRESIAS, datos, {
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });

        return respuesta.data;
    },

    async editar(id, datos, csrfToken) {
        const respuesta = await api.patch(`${RUTA_MEMBRESIAS}/${id}`, datos, {
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });

        return respuesta.data;
    },

    async cancelar(id, csrfToken) {
        const respuesta = await api.patch(
            `${RUTA_MEMBRESIAS}/${id}/estado`,
            { estado: 'CANCELADA' },
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    }
};

export default membresiasServicio;