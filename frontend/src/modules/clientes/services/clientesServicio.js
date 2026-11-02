import api from '../../../api/axios';

const RUTA_CLIENTES = '/clientes';

const clientesServicio = {
    async listar(filtros = {}) {
        const respuesta = await api.get(RUTA_CLIENTES, {
            params: filtros
        });

        return respuesta.data;
    },

    async obtener(id) {
        const respuesta = await api.get(`${RUTA_CLIENTES}/${id}`);

        return respuesta.data;
    },

    async crear(datos, csrfToken) {
        const respuesta = await api.post(
            RUTA_CLIENTES,
            datos,
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    },

    async editar(id, datos, csrfToken) {
        const respuesta = await api.patch(
            `${RUTA_CLIENTES}/${id}`,
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
            `${RUTA_CLIENTES}/${id}/estado`,
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

export default clientesServicio;