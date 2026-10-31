import {
    createContext,
    useContext,
    useEffect,
    useState
} from 'react';

import authService from '../modules/auth/services/authService';

const AuthContext = createContext(null);

const CLAVE_CSRF = 'proyectogym_csrf';

export function AuthProvider({ children }) {
    const [usuario, setUsuario] = useState(null);
    const [csrfToken, setCsrfToken] = useState(
        () => sessionStorage.getItem(CLAVE_CSRF)
    );
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const verificarSesion = async () => {
            try {
                const data = await authService.obtenerPerfil();
                setUsuario(data.usuario);
            } catch {
                setUsuario(null);
                setCsrfToken(null);
                sessionStorage.removeItem(CLAVE_CSRF);
            } finally {
                setCargando(false);
            }
        };

        verificarSesion();
    }, []);

    const iniciarSesion = async (datos) => {
        const data = await authService.login(datos);

        sessionStorage.setItem(CLAVE_CSRF, data.csrfToken);

        setCsrfToken(data.csrfToken);
        setUsuario(data.usuario);

        return data;
    };

    const cerrarSesion = async () => {
        try {
            if (!csrfToken) {
                throw new Error('No hay un token CSRF disponible.');
            }

            await authService.logout(csrfToken);
        } finally {
            sessionStorage.removeItem(CLAVE_CSRF);
            setCsrfToken(null);
            setUsuario(null);
        }
    };

    return (
        <AuthContext.Provider
            value={{
                usuario,
                csrfToken,
                cargando,
                autenticado: Boolean(usuario),
                iniciarSesion,
                cerrarSesion
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const contexto = useContext(AuthContext);

    if (!contexto) {
        throw new Error(
            'useAuth debe utilizarse dentro de AuthProvider.'
        );
    }

    return contexto;
}