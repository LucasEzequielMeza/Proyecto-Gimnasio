import api from '../../../api/axios';

const RUTA_PAGOS = '/pagos';

const pagosServicio = {
    async listarObligaciones(filtros = {}) {
        const respuesta = await api.get(`${RUTA_PAGOS}/obligaciones`, {
            params: filtros
        });

        return respuesta.data;
    },

    async obtenerObligacion(id) {
        const respuesta = await api.get(`${RUTA_PAGOS}/obligaciones/${id}`);
        return respuesta.data;
    },

    async cancelarObligacion(id, csrfToken) {
        const respuesta = await api.patch(
            `${RUTA_PAGOS}/obligaciones/${id}/cancelar`,
            {},
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    },

    async listarPagos(filtros = {}) {
        const respuesta = await api.get(RUTA_PAGOS, {
            params: filtros
        });

        return respuesta.data;
    },

    async obtenerPago(id) {
        const respuesta = await api.get(`${RUTA_PAGOS}/${id}`);
        return respuesta.data;
    },

    async crearPago(datos, csrfToken) {
        const respuesta = await api.post(RUTA_PAGOS, datos, {
            headers: {
                'X-CSRF-Token': csrfToken
            }
        });

        return respuesta.data;
    }
};

export default pagosServicio;