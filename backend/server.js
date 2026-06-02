/**
 * server.js - Express + Socket.io para notificaciones en tiempo real.
 */
require("dotenv").config();

const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const { Server } = require("socket.io");

const authRoutes = require("./src/routes/auth.routes");
const sucursalesRoutes = require("./src/routes/sucursales.routes");
const usuariosRoutes = require("./src/routes/usuarios.routes");
const registrosRoutes = require("./src/routes/registros.routes");
const puestosRoutes = require("./src/routes/puestos.routes");
const horariosRoutes = require("./src/routes/horarios.routes");
const gruposRoutes = require("./src/routes/grupos.routes");
const incidenciasRoutes = require("./src/routes/incidencias.routes");
const notificacionesRoutes = require("./src/routes/notificaciones.routes");
const reportesRoutes = require("./src/routes/reportes.routes");
const configRoutes = require("./src/routes/config.routes");
const auditoriaRoutes = require("./src/routes/auditoria.routes");
const aclaracionesRoutes = require("./src/routes/aclaraciones.routes");
const logsRoutes = require("./src/routes/logs.routes");
const anunciosRoutes = require("./src/routes/anuncios.routes");
const calendarioRoutes = require("./src/routes/calendario.routes");
const vacacionesRoutes = require("./src/routes/vacaciones.routes");
const areasRoutes = require("./src/routes/areas.routes");
const doRoutes = require("./src/routes/do.routes");
const rolesRoutes = require("./src/routes/roles.routes");
const { auditarAccion } = require("./src/middleware/auditoria.middleware");
const notifService = require("./src/services/notificaciones.service");
const logsService  = require("./src/services/logs.service");
const store = require("./src/data/store");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;

// ─── CORS explícito con lista blanca desde .env ────────────────────────────
const ALLOWED_ORIGINS = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Regex para permitir cualquier IP de red local (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
const LOCAL_NETWORK_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir peticiones sin origin (Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (LOCAL_NETWORK_REGEX.test(origin)) return callback(null, true);
    callback(new Error(`CORS bloqueado: Origin '${origin}' no está en la lista blanca`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// ─── Rate Limiting ─────────────────────────────────────────────────────────
/** Límite general: 300 req / 15 min por IP */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta nuevamente en 15 minutos." },
});

/** Límite en endpoints de auth: 30 req / 15 min por IP */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta nuevamente en 15 minutos." },
});

/** Límite estricto para login: 10 intentos fallidos / 15 min por IP */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // solo cuenta los fallidos
  message: { error: "Demasiados intentos de acceso fallidos. Espera 15 minutos." },
});

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || LOCAL_NETWORK_REGEX.test(origin))
        return callback(null, true);
      callback(new Error('Socket.io CORS bloqueado'));
    },
    methods: ["GET", "POST"]
  },
});

notifService.setIo(io);

io.on("connection", (socket) => {
  socket.on("registrar_usuario", (userId) => {
    if (userId) socket.join(`user:${userId}`);
  });
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight para todos los endpoints
app.use(globalLimiter);
app.use(express.json());
app.use(morgan("dev"));
app.use(async (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (!req.path.startsWith("/api/")) return next();
  if (req.path === "/api/health") return next();

  try {
    await store.refreshFromDatabaseIfNeeded();
  } catch (error) {
    console.error("No se pudo refrescar el snapshot desde MySQL:", error.message);
  }

  next();
});
app.use(auditarAccion);
// Contar peticiones para métricas de salud
app.use((req, _res, next) => { logsService.incrementRequests(); next(); });
// /uploads: archivos estáticos (imágenes de empleados y adjuntos)
// Nota: no se protege con JWT porque los <img src> del navegador no pueden
// enviar cabeceras Authorization. Los UUIDs de nombres de archivo actúan
// como tokens opacos suficientemente seguros para este uso.
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Rate limiting granular para auth
// ⚠️  DESHABILITADO EN DESARROLLO — habilitar en producción
// app.use("/api/auth/login", loginLimiter);
// app.use("/api/auth", authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/sucursales", sucursalesRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/registros", registrosRoutes);
app.use("/api/puestos", puestosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/incidencias", incidenciasRoutes);
app.use("/api/notificaciones", notificacionesRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/config", configRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/aclaraciones", aclaracionesRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/anuncios", anunciosRoutes);
app.use("/api/calendario", calendarioRoutes);
app.use("/api/vacaciones", vacacionesRoutes);
app.use("/api/areas", areasRoutes);
app.use("/api/do", doRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/sync",  require("./src/routes/sync.routes"));
app.get("/api/health", (req, res) =>
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    database: store.getDatabaseStatus(),
  })
);

app.use((req, res) => res.status(404).json({ error: "Ruta no encontrada" }));
app.use((err, req, res, _next) => {
  console.error(err);
  // Registrar en el buffer de logs de plataforma
  logsService.logError(
    err.message || "Error interno del servidor",
    `${req.method} ${req.path}`,
    err.stack || null,
    "error"
  );
  res.status(500).json({ error: "Error interno del servidor" });
});

const startServer = async () => {
  await store.initializeFromDatabase();

  server.listen(PORT, '0.0.0.0', () => {
    const dbStatus = store.getDatabaseStatus();
    console.log(`\nServidor en http://0.0.0.0:${PORT}`);
    console.log("Socket.io activo");
    console.log("Archivos en /uploads");

    if (dbStatus.enabled && dbStatus.connected) {
      console.log(`MySQL sincronizado con schema '${dbStatus.database}'\n`);
      return;
    }

    if (dbStatus.enabled) {
      console.log(`MySQL no disponible (${dbStatus.lastError || "sin detalle"}). Se usa store en memoria.\n`);
      return;
    }

    console.log("MySQL deshabilitado. Se usa store en memoria.\n");
  });
};

startServer().catch((error) => {
  console.error("No se pudo inicializar el servidor:", error);
  process.exit(1);
});

module.exports = { app, io };
