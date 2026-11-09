import api from '../../../api/axios';

const RUTA_USUARIOS = '/usuarios';

const usuariosServicio = {
    async listar(filtros = {}) {
        const respuesta = await api.get(RUTA_USUARIOS, {
            params: filtros
        });

        return respuesta.data;
    },

    async listarRoles() {
        const respuesta = await api.get(
            `${RUTA_USUARIOS}/roles`
        );

        return respuesta.data;
    },

    async obtener(id) {
        const respuesta = await api.get(
            `${RUTA_USUARIOS}/${id}`
        );

        return respuesta.data;
    },

    async crear(datos, csrfToken) {
        const respuesta = await api.post(
            RUTA_USUARIOS,
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
            `${RUTA_USUARIOS}/${id}`,
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
            `${RUTA_USUARIOS}/${id}/estado`,
            { estado },
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    },

    async cambiarRoles(id, roles, csrfToken) {
        const respuesta = await api.put(
            `${RUTA_USUARIOS}/${id}/roles`,
            { roles },
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    }
};

export default usuariosServicio;