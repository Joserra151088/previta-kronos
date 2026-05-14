/**
 * SocketContext.jsx
 * Gestiona la conexión Socket.io. Se conecta al login y se desconecta al logout.
 * Cada usuario se une a su sala privada "user:{userId}" para recibir notificaciones.
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SocketContext = createContext(null);

import { SERVER_URL as SOCKET_URL } from "../utils/config.js";

export const SocketProvider = ({ children, usuario }) => {
  const socketRef = useRef(null);
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!usuario) {
      // Sin usuario: desconectar si hay socket activo
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConectado(false);
      }
      return;
    }

    // Conectar con el token del localStorage
    const token = localStorage.getItem("token");
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      setConectado(true);
      // Unirse a la sala privada del usuario
      socket.emit("registrar_usuario", usuario.id);
    });

    socket.on("disconnect", () => setConectado(false));
    socket.on("connect_error", () => setConectado(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConectado(false);
    };
  }, [usuario?.id]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, conectado }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
