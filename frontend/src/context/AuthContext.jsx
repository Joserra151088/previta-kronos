/**
 * AuthContext.jsx - Contexto de autenticación + Socket.io + Notificaciones.
 */

import { createContext, useContext, useState, useEffect } from "react";
import { getMe, getMisModulos, login as apiLogin, logout as apiLogout, verifyLogin2FA as apiVerify2FA } from "../utils/api";
import { SocketProvider, useSocket } from "./SocketContext";
import { NotificacionesProvider } from "./NotificacionesContext";
import { getModulesForUser } from "../utils/module-access";

const AuthContext = createContext(null);

const InnerProvider = ({ children, usuario }) => {
  const { socket } = useSocket();
  return (
    <NotificacionesProvider usuario={usuario} socket={socket}>
      {children}
    </NotificacionesProvider>
  );
};

export const AuthProvider = ({ children }) => {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [vistaActual, setVistaActual] = useState("admin"); // "admin" | "empleado"

  const cargarSesion = async () => {
    // Leer puedeEditar desde el JWT (sin verificar firma – solo decodificar claims)
    let puedeEditar = true;
    try {
      const token   = localStorage.getItem("token");
      const payload = token ? JSON.parse(atob(token.split(".")[1])) : {};
      // Si el claim existe tomarlo; si no existe (tokens viejos) asumir true
      puedeEditar = payload.puedeEditar !== false;
    } catch (_) { /* token malformado o ausente */ }

    const perfil = await getMe();
    try {
      const permisos = await getMisModulos();
      return { ...perfil, modulos: permisos.modulos || getModulesForUser(perfil), puedeEditar };
    } catch {
      return { ...perfil, modulos: getModulesForUser(perfil), puedeEditar };
    }
  };

  useEffect(() => {
    const verificarSesion = async () => {
      const token = localStorage.getItem("token");
      if (!token) { setCargando(false); return; }
      try {
        const perfil = await cargarSesion();
        setUsuario(perfil);
      } catch {
        localStorage.removeItem("token");
      } finally {
        setCargando(false);
      }
    };
    verificarSesion();
  }, []);

  const login = async (email, password, sucursalIdLogin = null) => {
    const data = await apiLogin(email, password, sucursalIdLogin);
    if (data.token) {
      const perfil = await cargarSesion();
      setUsuario(perfil);
    }
    return data;
  };

  const verifyLogin2FA = async (challengeId, code) => {
    const data = await apiVerify2FA(challengeId, code);
    if (data.token) {
      const perfil = await cargarSesion();
      setUsuario(perfil);
    }
    return data;
  };

  const logout = () => {
    apiLogout();
    setUsuario(null);
  };

  const toggleVista = () =>
    setVistaActual((v) => (v === "admin" ? "empleado" : "admin"));

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout, verifyLogin2FA, setUsuario, vistaActual, setVistaActual, toggleVista }}>
      <SocketProvider usuario={usuario}>
        <InnerProvider usuario={usuario}>
          {children}
        </InnerProvider>
      </SocketProvider>
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
