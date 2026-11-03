import api from '../../../api/axios';

const RUTA_PLANES = '/planes';

const planesServicio = {
    async listar(filtros = {}) {
        const respuesta = await api.get(RUTA_PLANES, {
            params: filtros
        });

        return respuesta.data;
    },

    async obtener(id) {
        const respuesta = await api.get(`${RUTA_PLANES}/${id}`);
        return respuesta.data;
    },

    async crear(datos, csrfToken) {
        const respuesta = await api.post(RUTA_PLANES, datos, {
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });

        return respuesta.data;
    },

    async editar(id, datos, csrfToken) {
        const respuesta = await api.patch(
            `${RUTA_PLANES}/${id}`,
            datos,
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    },

    async cambiarEstado(id, estado, csrfToken) {
        const respuesta = await api.patch(
            `${RUTA_PLANES}/${id}/estado`,
            { estado },
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    }
};

export default planesServicio;