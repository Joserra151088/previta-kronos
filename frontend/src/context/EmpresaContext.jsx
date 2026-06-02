import { createContext, useContext, useEffect, useState } from "react";
import { getEmpresaConfig } from "../utils/api";

const EmpresaContext = createContext(null);
const BASE = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";

const DEFAULT_EMPRESA = {
  nombre: "Kronos",
  razonSocial: "",
  rfc: "",
  domicilio: "",
  telefono: "",
  email: "",
  logoUrl: null,
};

/** Actualiza el favicon del documento con la URL indicada */
function actualizarFavicon(url) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = url.endsWith(".svg") ? "image/svg+xml" : "image/png";
  link.href = url;
}

export const EmpresaProvider = ({ children }) => {
  const [empresa, setEmpresa] = useState(DEFAULT_EMPRESA);

  const refreshEmpresa = async () => {
    try {
      const data = await getEmpresaConfig();
      setEmpresa((prev) => ({ ...prev, ...data }));
    } catch {
      // Mantener fallback local si el backend no responde.
    }
  };

  // Actualizar favicon cuando cambie el logo de la empresa
  useEffect(() => {
    if (empresa.logoUrl) {
      actualizarFavicon(`${BASE}${empresa.logoUrl}`);
    }
  }, [empresa.logoUrl]);

  useEffect(() => {
    refreshEmpresa();
  }, []);

  return (
    <EmpresaContext.Provider value={{ empresa, setEmpresa, refreshEmpresa }}>
      {children}
    </EmpresaContext.Provider>
  );
};

export const useEmpresa = () => useContext(EmpresaContext);
