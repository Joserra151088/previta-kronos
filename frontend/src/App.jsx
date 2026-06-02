import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Eventos from "./pages/Eventos";
import Sucursales from "./pages/Sucursales";
import Usuarios from "./pages/Usuarios";
import Registros from "./pages/Registros";
import Incidencias from "./pages/Incidencias";
import Vacaciones from "./pages/Vacaciones";
import Incapacidades from "./pages/Incapacidades";
import Calendario from "./pages/Calendario";
import Organigrama from "./pages/Organigrama";
import Reportes from "./pages/Reportes";
import Notificaciones from "./pages/Notificaciones";
import Admin from "./pages/Admin";
import Grupos from "./pages/Grupos";
import Mapa from "./pages/Mapa";
import Perfil from "./pages/Perfil";
import Auditoria from "./pages/Auditoria";
import Logs from "./pages/Logs";
import Horarios from "./pages/Horarios";
import Licencias from "./pages/Licencias";
import Anuncios from "./pages/Anuncios";
import DesarrolloOrganizacional from "./pages/DesarrolloOrganizacional";
import NineBox from "./pages/NineBox";
import Sync from "./pages/Sync";

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rutas protegidas */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={
            <ProtectedRoute moduleKey="dashboard"><Dashboard /></ProtectedRoute>
          } />
          <Route path="eventos" element={
            <ProtectedRoute moduleKey="eventos"><Eventos /></ProtectedRoute>
          } />
          <Route path="registros" element={<Registros />} />
          <Route path="incidencias" element={
            <ProtectedRoute moduleKey="incidencias">
              <Incidencias />
            </ProtectedRoute>
          } />
          <Route path="reportes" element={
            <ProtectedRoute moduleKey="reportes"><Reportes /></ProtectedRoute>
          } />
          <Route path="notificaciones" element={
            <ProtectedRoute moduleKey="notificaciones"><Notificaciones /></ProtectedRoute>
          } />
          <Route path="sucursales" element={
            <ProtectedRoute moduleKey="sucursales"><Sucursales /></ProtectedRoute>
          } />
          <Route path="empleados" element={
            <ProtectedRoute moduleKey="empleados"><Usuarios /></ProtectedRoute>
          } />
          <Route path="grupos" element={
            <ProtectedRoute moduleKey="grupos"><Grupos /></ProtectedRoute>
          } />
          <Route path="admin" element={
            <ProtectedRoute moduleKey="administracion"><Admin /></ProtectedRoute>
          } />
          {/* Acceso directo por sección — muestran solo sus propias pestañas */}
          <Route path="puestos" element={
            <ProtectedRoute moduleKey="administracion">
              <Admin defaultTab="puestos" visibleTabs={["puestos", "roles"]} />
            </ProtectedRoute>
          } />
          <Route path="areas" element={
            <ProtectedRoute moduleKey="administracion">
              <Admin defaultTab="areas" visibleTabs={["areas"]} />
            </ProtectedRoute>
          } />
          <Route path="empresa" element={
            <ProtectedRoute moduleKey="administracion">
              <Admin defaultTab="empresa" visibleTabs={["empresa"]} />
            </ProtectedRoute>
          } />
          <Route path="anuncios-admin" element={
            <ProtectedRoute moduleKey="administracion">
              <Anuncios />
            </ProtectedRoute>
          } />
          <Route path="mapa" element={
            <ProtectedRoute moduleKey="mapa"><Mapa /></ProtectedRoute>
          } />
          <Route path="vacaciones" element={
            <ProtectedRoute moduleKey="vacaciones"><Vacaciones /></ProtectedRoute>
          } />
          <Route path="incapacidades" element={
            <ProtectedRoute moduleKey="incapacidades"><Incapacidades /></ProtectedRoute>
          } />
          <Route path="calendario" element={
            <ProtectedRoute moduleKey="calendario"><Calendario /></ProtectedRoute>
          } />
          <Route path="organigrama" element={
            <ProtectedRoute moduleKey="organigrama"><Organigrama /></ProtectedRoute>
          } />
          {/* Vista empleado */}
          <Route path="mis-incidencias" element={<Incidencias />} />
          <Route path="mis-registros"   element={<Registros />} />
          <Route path="perfil" element={<Perfil />} />
          <Route path="auditoria" element={
            <ProtectedRoute moduleKey="auditoria"><Auditoria /></ProtectedRoute>
          } />
          <Route path="logs" element={
            <ProtectedRoute moduleKey="logs"><Logs /></ProtectedRoute>
          } />
          <Route path="horarios" element={
            <ProtectedRoute moduleKey="horarios"><Horarios /></ProtectedRoute>
          } />
          <Route path="licencias" element={
            <ProtectedRoute moduleKey="licencias"><Licencias /></ProtectedRoute>
          } />
          <Route path="sync" element={
            <ProtectedRoute moduleKey="administracion"><Sync /></ProtectedRoute>
          } />
          <Route path="desarrollo-organizacional" element={
            <ProtectedRoute moduleKey="desarrollo_organizacional">
              <DesarrolloOrganizacional />
            </ProtectedRoute>
          } />
          <Route path="nine-box" element={
            <ProtectedRoute moduleKey="desarrollo_organizacional">
              <NineBox />
            </ProtectedRoute>
          } />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
