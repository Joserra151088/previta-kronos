# Kronos — Sistema de Control de Acceso y Asistencia

**Previta S.A. de C.V.**

Sistema de registro de asistencia con control de acceso por sucursal, geocercas GPS, notificaciones en tiempo real y reportes de minutos trabajados.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Node.js + Express.js + Socket.io |
| Frontend | React 18 + Vite |
| Base de datos | MySQL 8 (AWS RDS) |
| Autenticación | JWT + bcryptjs + 2FA (TOTP) |
| Tiempo real | Socket.io |

---

## Requisitos previos

- Node.js v18+
- Acceso al RDS de AWS (misma instancia que Athenasys)
- La base de datos `previta_kronos` creada en ese servidor

---

## Configuración inicial

### 1. Crear la base de datos

Conectarse al RDS y ejecutar el schema completo:

```bash
mysql -h <RDS_HOST> -u <USUARIO> -p < backend/schema.sql
```

### 2. Configurar variables de entorno

```bash
cp backend/.env.example backend/.env
# Editar backend/.env con las credenciales del RDS
```

Variables obligatorias en `backend/.env`:

```
DB_HOST=<host_del_rds>
DB_NAME=previta_kronos
DB_USER=<usuario>
DB_PASSWORD=<password>
JWT_SECRET=<secreto_de_64_chars>
ATHENASYS_DB_NAME=athenasys
FRONTEND_URL=https://kronos.previta.com.mx
```

### 3. Ejecutar el seed (datos iniciales y usuarios)

```bash
cd backend
npm install
node scripts/seed.js
```

Esto limpia cualquier dato existente y crea:
- Configuración de empresa Previta
- **Super admin**: jose.estrada@previta.com.mx
- 6 usuarios de prueba (uno por rol)

### 4. Instalar dependencias y ejecutar

```bash
# Backend
cd backend && npm install && npm run dev

# Frontend (en otra terminal)
cd frontend && npm install && npm run dev
```

El backend corre en `http://localhost:4000`  
El frontend corre en `http://localhost:5173`

---

## Usuarios iniciales

| Email | Rol | Contraseña inicial |
|-------|-----|-------------------|
| jose.estrada@previta.com.mx | Super Admin | Previta@Admin2026! |
| soporte.ti@previta.com.mx | Agente Soporte TI | Previta@TI2026! |
| supervisor@previta.com.mx | Supervisor Sucursales | Previta2026! |
| asistencia@previta.com.mx | Agente Control Asistencia | Previta2026! |
| visor@previta.com.mx | Visor Reportes | Previta2026! |
| medico.titular@previta.com.mx | Médico Titular | Previta2026! |
| medico.guardia@previta.com.mx | Médico de Guardia | Previta2026! |

> Cambiar todas las contraseñas después del primer acceso.

---

## Integración con Athenasys (cross-DB)

Kronos puede consultar en tiempo real los empleados y sucursales registrados en la base de datos `athenasys` del mismo servidor RDS mediante JOINs cross-DB.

### Permisos necesarios en el RDS

```sql
GRANT SELECT ON athenasys.* TO 'tu_usuario'@'%';
FLUSH PRIVILEGES;
```

### Configuración pendiente

El servicio está en `backend/src/services/athenasys.service.js`.  
Completar los nombres reales de tablas y columnas antes de activarlo:

- `TABLA_EMPLEADOS_AQUI` → nombre real de la tabla de empleados en Athenasys
- `TABLA_SUCURSALES_AQUI` → nombre real de la tabla de sucursales/centros

---

## Roles del sistema

| Clave | Nombre | Acceso |
|-------|--------|--------|
| `super_admin` | Super Administrador | Total, sin restricciones |
| `agente_soporte_ti` | Agente Soporte TI | Administración de plataforma |
| `supervisor_sucursales` | Supervisor de Sucursales | Empleados y asistencias de sus sucursales |
| `agente_control_asistencia` | Agente Control Asistencia | Registro y revisión de asistencias |
| `visor_reportes` | Visor de Reportes | Solo lectura de reportes y mapas |
| `medico_titular` | Médico Titular | Incidencias médicas de su sucursal |
| `medico_de_guardia` | Médico de Guardia | Incidencias médicas sin sucursal fija |

---

## Scripts disponibles

```bash
# Backend
npm run dev          # Desarrollo con nodemon (puerto 4000)
npm start            # Producción

# Administración de BD
node scripts/seed.js # Reset completo + usuarios iniciales

# Frontend
npm run dev          # Desarrollo con HMR (puerto 5173)
npm run build        # Build de producción
npm run preview      # Preview del build
```

---

## Capacidad

Plataforma dimensionada para **300 usuarios activos**.  
Pool de conexiones (`DB_CONNECTION_LIMIT=20`) soporta la carga concurrente esperada.
