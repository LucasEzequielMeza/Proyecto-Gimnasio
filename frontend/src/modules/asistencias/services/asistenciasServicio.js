import api from '../../../api/axios';

const RUTA_ASISTENCIAS = '/asistencias';

const asistenciasServicio = {
    async listar(filtros = {}) {
        const respuesta = await api.get(RUTA_ASISTENCIAS, {
            params: filtros
        });

        return respuesta.data;
    },

    async obtener(id) {
        const respuesta = await api.get(
            `${RUTA_ASISTENCIAS}/${id}`
        );

        return respuesta.data;
    },

    async registrar(datos, csrfToken) {
        const respuesta = await api.post(
            RUTA_ASISTENCIAS,
            datos,
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return respuesta.data;
    }
};

export default asistenciasServicio;