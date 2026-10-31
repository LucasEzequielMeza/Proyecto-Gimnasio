import api from '../../../api/axios';
import ENDPOINTS from '../../../api/endpoints';

const authService = {
    async login(datos) {
        const response = await api.post(
            ENDPOINTS.AUTH.LOGIN,
            datos
        );

        return response.data;
    },

    async obtenerPerfil() {
        const response = await api.get(
            ENDPOINTS.AUTH.PROFILE
        );

        return response.data;
    },

    async logout(csrfToken) {
        const response = await api.post(
            ENDPOINTS.AUTH.LOGOUT,
            {},
            {
                headers: {
                    'X-CSRF-Token': csrfToken
                }
            }
        );

        return response.data;
    }
};

export default authService;