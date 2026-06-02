# 🏥 KronOS — Plataforma de Gestión de Personal Previta

Sistema web full-stack para gestionar acceso, asistencia, evaluaciones de desempeño y desarrollo organizacional de empleados en múltiples sucursales, con geocercas GPS, módulo de auditoría, reportes detallados y configuración dinámica de empresa.

**Rama activa:** `develop` | **Stack:** React + Vite · Express.js · MySQL 8

---

## 📁 Estructura del Proyecto

```
access-control/
├── backend/                               # API REST con Express.js
│   ├── server.js                          # Punto de entrada; middlewares globales
│   ├── schema.sql                         # Esquema completo de la base de datos
│   ├── migrations/                        # Migraciones incrementales (001–011)
│   └── src/
│       ├── config/
│       │   └── db.js                      # Conexión MySQL con pool
│       ├── data/
│       │   └── store.js                   # Store en memoria sincronizado con MySQL
│       ├── middleware/
│       │   ├── auth.js                    # Autenticación JWT
│       │   ├── roles.js                   # requireRoles() + constantes ROLES (10 roles)
│       │   └── auditoria.middleware.js    # Intercepta res.json y guarda auditoría
│       ├── routes/
│       │   ├── auth.routes.js             # Login / perfil propio / 2FA
│       │   ├── usuarios.routes.js         # CRUD empleados + foto + importación CSV
│       │   ├── sucursales.routes.js       # CRUD sucursales + geocerca
│       │   ├── roles.routes.js            # CRUD dinámico de roles del sistema
│       │   ├── registros.routes.js        # Registros de acceso + manual + mapa
│       │   ├── reportes.routes.js         # Reportes exportables (CSV/Excel)
│       │   ├── incidencias.routes.js      # Solicitudes y aprobaciones
│       │   ├── notificaciones.routes.js   # Centro de notificaciones
│       │   ├── horarios.routes.js         # CRUD horarios laborales
│       │   ├── puestos.routes.js          # CRUD puestos + campos personalizados
│       │   ├── areas.routes.js            # CRUD áreas organizacionales
│       │   ├── grupos.routes.js           # Agrupación de sucursales
│       │   ├── anuncios.routes.js         # Anuncios/comunicados con destinatarios
│       │   ├── config.routes.js           # Config de módulos por rol + empresa
│       │   ├── auditoria.routes.js        # Consulta de bitácora
│       │   ├── logs.routes.js             # Salud de plataforma y logs de errores
│       │   ├── vacaciones.routes.js       # Gestión de vacaciones
│       │   ├── calendario.routes.js       # Vista de calendario
│       │   └── do.routes.js              # Desarrollo Organizacional (DO)
│       └── services/
│           ├── notificaciones.service.js  # WebSocket / eventos en tiempo real
│           └── logs.service.js            # Buffer de logs de plataforma
│
└── frontend/                              # SPA React + Vite
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx                       # Entrada React + QueryClientProvider
        ├── App.jsx                        # Router principal con rutas protegidas
        ├── index.css                      # Estilos globales (tema oscuro/claro/Previta)
        ├── context/
        │   ├── AuthContext.jsx            # Estado global de autenticación + JWT
        │   ├── EmpresaContext.jsx         # Configuración dinámica de la empresa
        │   ├── ThemeContext.jsx           # Temas: oscuro / claro / sistema / custom
        │   └── SocketContext.jsx          # WebSocket para eventos en tiempo real
        ├── components/
        │   ├── Layout.jsx                 # Top nav responsiva + drawer + panel lateral
        │   ├── ProtectedRoute.jsx         # Guarda de rutas por módulo/rol
        │   ├── ConfirmDialog.jsx          # Modal de confirmación animado (useConfirm hook)
        │   ├── NotificationBell.jsx       # Campana de notificaciones en tiempo real
        │   └── ThemeToggle.jsx            # Selector de tema
        ├── pages/
        │   ├── Login.jsx                  # Inicio de sesión (sin usuarios demo)
        │   ├── Dashboard.jsx              # Registro diario con GPS — layout 2 columnas
        │   ├── Eventos.jsx                # Feed en tiempo real de asistencia
        │   ├── Sucursales.jsx             # Gestión de sucursales y geocercas
        │   ├── Usuarios.jsx               # Gestión de empleados (roles dinámicos)
        │   ├── Registros.jsx              # Historial de registros + registro manual
        │   ├── Incidencias.jsx            # Solicitudes y aprobaciones de incidencias
        │   ├── Reportes.jsx               # Reportes de asistencia y minutos
        │   ├── Notificaciones.jsx         # Centro de notificaciones
        │   ├── Admin.jsx                  # Administración: puestos, horarios, roles, empresa
        │   ├── Grupos.jsx                 # Agrupación de sucursales por región
        │   ├── Mapa.jsx                   # Mapa interactivo Leaflet con filtros
        │   ├── Perfil.jsx                 # Edición del perfil propio
        │   ├── Auditoria.jsx              # Bitácora de acciones (super_admin)
        │   ├── Anuncios.jsx               # Comunicados con editor rico y destinatarios
        │   ├── DesarrolloOrganizacional.jsx  # Módulo DO: competencias, 360, 1:1, KPIs
        │   └── NineBox.jsx                # Matriz 9-box de talento
        └── utils/
            ├── api.js                     # Capa completa de comunicación HTTP
            ├── toast.jsx                  # Notificaciones + confirmar() centrado animado
            ├── export.js                  # Exportación a CSV/Excel
            └── module-access.js           # Permisos dinámicos de módulos por rol
```

---

## 🚀 Instrucciones de instalación

### Requisitos previos
- **Node.js** v18 o superior
- **MySQL** 8.0
- **npm** v9 o superior

### 1. Configurar la base de datos

```bash
# Crear la base de datos y aplicar el esquema
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS kronos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p kronos < backend/schema.sql

# Aplicar migraciones incrementales en orden
mysql -u root -p kronos < backend/migrations/001_initial.sql
mysql -u root -p kronos < backend/migrations/002_add_nominas.sql
# ... hasta 011_roles_administrador_general.sql
```

### 2. Configurar variables de entorno del Backend

Crear `backend/.env`:

```env
PORT=4000
JWT_SECRET=tu_secreto_jwt_seguro
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=kronos
DB_USER=root
DB_PASSWORD=tu_password
DB_CONNECTION_LIMIT=10
FRONTEND_URL=http://localhost:5173
```

### 3. Instalar y levantar el Backend

```bash
cd backend
npm install
npm run dev       # Con recarga automática (nodemon)
# ó
npm start         # Sin recarga automática
```

El servidor queda corriendo en: **http://localhost:4000**

### 4. Instalar y levantar el Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend queda disponible en: **http://localhost:5173**

---

## 👥 Acceso al sistema

El sistema no tiene usuarios demo. Para acceder, usar las credenciales del administrador principal:

| Rol                    | Email                             | Descripción                          |
|------------------------|-----------------------------------|--------------------------------------|
| 👑 Administrador General | jose.estrada@previta.com.mx     | Acceso total al sistema              |

Las credenciales de otros empleados se gestionan desde el módulo **Empleados** dentro de la plataforma.

> **Nota de desarrollo:** El rate limiting y bloqueo por intentos fallidos están deshabilitados en la rama `develop`. Habilitarlos antes de producción en `backend/server.js` y `backend/src/routes/auth.routes.js`.

---

## 🔑 Funcionalidades

### 📋 Registro de asistencia
- ✅ 4 registros diarios: entrada, salida a alimentos, regreso, salida final
- ✅ Validación de geocerca circular con fórmula de Haversine
- ✅ Cooldown de 1 hora entre registros para prevenir duplicados
- ✅ **Registro manual** por agentes autorizados con aprobación de supervisores
- ✅ Feed en tiempo real de eventos de asistencia (`/eventos`)

### 👥 Gestión de personal
- ✅ CRUD completo de empleados con foto de perfil e importación CSV
- ✅ Asignación de puesto, sucursal, área, grupo y horario laboral
- ✅ **Roles dinámicos desde BD**: el selector de rol en la ficha del empleado carga los roles reales
- ✅ **Campos personalizados por puesto** (texto, número, fecha, selección)
- ✅ Autenticación de doble factor (2FA / TOTP)
- ✅ Restablecimiento de 2FA por administradores
- ✅ Verificación de email en tiempo real al crear/editar empleado

### 🏢 Sucursales y geocercas
- ✅ CRUD de sucursales con geocercas configurables (lat, lng, radio en metros)
- ✅ Agrupación de sucursales por grupos/regiones
- ✅ **Mapa interactivo Leaflet** con filtros por grupo y estado de la república

### 📊 Reportes y análisis
- ✅ Reporte de asistencia por sucursal y fecha
- ✅ **Minutos trabajados** con desglose por empleado y por día
- ✅ Exportación a CSV/Excel
- ✅ Calendario de asistencia mensual

### 📝 Incidencias y vacaciones
- ✅ Solicitud y gestión de incidencias (permisos, faltas, ajustes de horario)
- ✅ Flujo de aprobación/rechazo con comentarios
- ✅ Módulo de vacaciones con cálculo de días disponibles
- ✅ Incapacidades con tipos médicos configurables

### 📢 Anuncios y comunicados
- ✅ Editor rico de comunicados con imágenes y formato
- ✅ **Destinatarios granulares**: todos, por grupo, por área o por persona
- ✅ Panel lateral con anuncios activos visible para todos los usuarios

### 🧠 Desarrollo Organizacional (DO)
- ✅ **Competencias**: catálogo con CRUD, tipos y descripción; editar y eliminar
- ✅ **Evaluación 360°**: por jefe inmediato, pares, subordinados y autoevaluación
  - Banco de preguntas personalizable por tipo de relación
- ✅ **Evaluación 1 a 1**: con plantillas de preguntas reutilizables
- ✅ **Indicadores de desempeño** (KPIs) por puesto con registro de valores
- ✅ **Matriz 9-Box** de talento (potencial × desempeño)
- ✅ **Satisfacción de clientes** a nivel empresa (KPI global configurable)

### ⚙️ Administración del sistema
- ✅ **Horarios laborales**: CRUD con horarios de alimentos incluidos
- ✅ **Puestos**: CRUD con campos extra personalizados; invalidación de caché inmediata
- ✅ **Áreas organizacionales**: CRUD dinámico
- ✅ **Roles del sistema**: CRUD completo — crear, editar y eliminar roles desde la interfaz; aparecen en la ficha del empleado
- ✅ **Permisos por módulo**: matriz editable de acceso por rol
- ✅ **Configuración de empresa**: nombre, RFC, dirección, logo

### 🔒 Seguridad y auditoría
- ✅ Autenticación con **JWT** (expiración configurable, por defecto 8 horas)
- ✅ **10 roles** con permisos granulares y configurables desde la interfaz:
  `administrador_general`, `super_admin`, `agente_soporte_ti`, `supervisor_sucursales`, `agente_control_asistencia`, `visor_reportes`, `medico_titular`, `medico_de_guardia`, `nominas`, `desarrollo_organizacional`
- ✅ **Eliminación real** de registros: al eliminar cualquier entidad (empleado, sucursal, puesto, etc.) se elimina permanentemente de la BD con confirmación obligatoria
- ✅ **Modal de confirmación animado**: centrado en pantalla con animación de entrada/salida, cierra con Escape
- ✅ **Módulo de auditoría**: bitácora completa de acciones con IP, usuario, fecha y método HTTP
- ✅ **Logs de plataforma**: errores del servidor, tiempo de respuesta y métricas de salud

### 🎨 Interfaz y experiencia
- ✅ **Diseño Previta**: verde `#77B328` y azul marino `#004269`
- ✅ Selector de tema: Oscuro / Claro / Sistema (OS) / Fondo personalizado
- ✅ **Navegación responsiva** — 4 breakpoints:
  - ≥ 1300 px → barra completa de tabs
  - 1024–1299 px → barra compacta (texto reducido)
  - 900–1023 px → barra mínima (sin texto de marca)
  - < 900 px → hamburger + drawer lateral animado
- ✅ El drawer móvil queda siempre **encima del mapa Leaflet** (z-index 1100)
- ✅ Notificaciones en tiempo real via WebSocket

---

## 📡 API Endpoints

### Autenticación
| Método | Ruta                       | Descripción                         |
|--------|----------------------------|-------------------------------------|
| POST   | /api/auth/login            | Iniciar sesión                      |
| GET    | /api/auth/me               | Perfil del usuario actual           |
| POST   | /api/auth/2fa/setup        | Configurar autenticador TOTP        |
| POST   | /api/auth/2fa/verify       | Verificar código TOTP               |

### Empleados y Roles
| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | /api/usuarios               | Listar empleados (paginado + filtros)      |
| POST   | /api/usuarios               | Crear empleado                             |
| PUT    | /api/usuarios/:id           | Actualizar empleado / perfil propio        |
| DELETE | /api/usuarios/:id           | **Eliminar permanentemente** empleado      |
| POST   | /api/usuarios/:id/foto      | Subir foto de perfil                       |
| POST   | /api/usuarios/importar      | Importar empleados desde CSV               |
| GET    | /api/roles                  | Listar todos los roles activos             |
| POST   | /api/roles                  | Crear rol personalizado                    |
| PUT    | /api/roles/:clave           | Actualizar nombre/descripción de rol       |
| DELETE | /api/roles/:clave           | Eliminar rol (si no tiene empleados)       |

### Sucursales y Grupos
| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | /api/sucursales             | Listar sucursales                          |
| POST   | /api/sucursales             | Crear sucursal                             |
| PUT    | /api/sucursales/:id         | Actualizar sucursal                        |
| DELETE | /api/sucursales/:id         | **Eliminar permanentemente** sucursal      |
| GET    | /api/grupos                 | Listar grupos de sucursales                |

### Registros y Reportes
| Método | Ruta                              | Descripción                           |
|--------|-----------------------------------|---------------------------------------|
| GET    | /api/registros                    | Listar registros (filtrados por rol)  |
| POST   | /api/registros                    | Realizar siguiente registro del día   |
| POST   | /api/registros/manual             | Captura manual de asistencia          |
| GET    | /api/registros/reporte            | Reporte por sucursal y fecha          |
| GET    | /api/registros/minutos-empleados  | Minutos trabajados por empleado       |
| GET    | /api/registros/mapa               | Datos del mapa de sucursales          |

### Catálogos
| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | /api/puestos                | Listar puestos activos                     |
| POST   | /api/puestos                | Crear puesto                               |
| DELETE | /api/puestos/:id            | **Eliminar permanentemente** puesto        |
| PUT    | /api/puestos/:id/campos     | Actualizar campos extra de un puesto       |
| GET    | /api/horarios               | Listar horarios laborales                  |
| GET    | /api/areas                  | Listar áreas organizacionales              |
| POST   | /api/areas                  | Crear área                                 |

### Configuración
| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | /api/config/roles           | Configuración de módulos por rol           |
| PUT    | /api/config/roles/:rol      | Actualizar módulos de un rol               |
| GET    | /api/config/empresa         | Datos de la empresa                        |
| PUT    | /api/config/empresa         | Actualizar datos de la empresa             |
| PUT    | /api/config/empresa/logo    | Subir logo de la empresa                   |

### Desarrollo Organizacional
| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | /api/do/competencias        | Listar competencias                        |
| POST   | /api/do/competencias        | Crear competencia                          |
| PUT    | /api/do/competencias/:id    | Actualizar competencia                     |
| DELETE | /api/do/competencias/:id    | **Eliminar permanentemente** competencia   |
| GET    | /api/do/eval360             | Listar evaluaciones 360°                   |
| POST   | /api/do/eval360             | Registrar evaluación 360°                  |
| GET    | /api/do/indicadores         | Listar indicadores KPI                     |
| GET    | /api/do/ninebox             | Datos para matriz 9-box                    |
| GET    | /api/do/satisfaccion        | Satisfacción de clientes (nivel empresa)   |

### Sistema
| Método | Ruta                        | Descripción                                |
|--------|-----------------------------|--------------------------------------------|
| GET    | /api/auditoria              | Consultar bitácora de acciones             |
| GET    | /api/logs                   | Logs de salud de la plataforma             |
| GET    | /api/health                 | Estado de la API y BD                      |

---

## 🗄️ Base de datos

El sistema usa **MySQL 8** con `utf8mb4_unicode_ci`. El store en memoria se sincroniza automáticamente con la BD:

- Al arrancar el servidor: carga el snapshot de MySQL → persiste a MySQL
- En cada operación de escritura: actualiza memoria → sincroniza a MySQL (debounced)
- En cada petición GET: refresca desde MySQL si el snapshot tiene más de 3 segundos

### Tablas principales

| Tabla                     | Descripción                              |
|---------------------------|------------------------------------------|
| `usuarios`                | Empleados con rol, puesto y sucursal     |
| `roles`                   | Roles del sistema (CRUD dinámico)        |
| `sucursales`              | Sucursales con geocerca                  |
| `grupos`                  | Agrupaciones de sucursales               |
| `registros`               | Registros de acceso diario               |
| `horarios`                | Horarios laborales con días y tolerancia |
| `puestos`                 | Puestos de trabajo con campos extra      |
| `areas`                   | Áreas organizacionales                   |
| `incidencias`             | Solicitudes de incidencia                |
| `anuncios`                | Comunicados con destinatarios JSON       |
| `do_competencias`         | Catálogo de competencias DO              |
| `do_eval_360`             | Evaluaciones 360°                        |
| `do_eval_1a1`             | Evaluaciones 1 a 1                       |
| `do_indicadores`          | KPIs por puesto                          |
| `do_satisfaccion`         | Satisfacción de clientes (empresa)       |
| `auditoria_eventos`       | Bitácora de acciones                     |

---

## 🎨 Identidad visual (Previta)

| Variable CSS        | Valor       | Uso                               |
|---------------------|-------------|-----------------------------------|
| `--accent`          | `#77B328`   | Verde Previta — botones y activos |
| `--accent2`         | `#8CC830`   | Verde claro (hover)               |
| `--previta-navy`    | `#004269`   | Azul marino — overlay bienvenida  |

---

## 🛰️ Geocercas

Cada sucursal tiene una geocerca circular:
- **Latitud y Longitud** del punto central
- **Radio en metros** (ej: 200 m)

Al registrar, el sistema usa la **fórmula de Haversine** para calcular la distancia entre el GPS del empleado y el centro. Si supera el radio, el registro es marcado como fuera de geocerca.

---

## 📌 Notas de desarrollo (rama `develop`)

| Configuración              | Estado actual           | Para producción                         |
|----------------------------|-------------------------|-----------------------------------------|
| Rate limiting              | ⚠️ Deshabilitado        | Habilitar en `server.js`                |
| Bloqueo por intentos       | ⚠️ `LOCK_THRESHOLD = Infinity` | Cambiar a `5` en `auth.routes.js` |
| Contraseñas                | Texto plano             | Implementar bcrypt                      |
| JWT_SECRET                 | Variable de entorno     | Usar valor largo aleatorio              |
| HTTPS                      | No configurado          | Requerido en producción                 |
