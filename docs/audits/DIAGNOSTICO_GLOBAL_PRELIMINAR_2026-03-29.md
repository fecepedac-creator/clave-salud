# Diagnóstico global preliminar — ClaveSalud (React + TypeScript + Firebase)

Fecha de corte: 2026-03-29.

## 1) Mapa del sistema (estructura, módulos, dominios)

### 1.1 Estructura de alto nivel del repositorio
- **Frontend principal (SPA React/TS):** raíz del repo con `App.tsx`, `components/`, `hooks/`, `utils/`, `types.ts`.
- **Backend serverless:** `functions/src/` (Firebase Cloud Functions).
- **Control de acceso y datos:** `firestore.rules`, `storage.rules`, `firestore.indexes.json`.
- **Automatización y QA:** `tests/`, `scripts/audit/`, `playwright.config.ts`.
- **Documentación operativa/legal:** `docs/`.

### 1.2 Mapa funcional por dominios
- **Autenticación y sesión:** Firebase Auth + perfil en `/users/{uid}` (`hooks/useAuth.ts`).
- **Multi-tenant por centro:** `activeCenterId`, contexto de centro y módulos (`CenterContext.ts`, `hooks/useCenters.ts`).
- **Pacientes (modelo híbrido):** colección raíz `/patients` + referencias/operaciones por centro (`hooks/useFirestoreSync.ts`, `hooks/useCrudOperations.ts`, `firestore.rules`).
- **Agenda clínica:** `/centers/{centerId}/appointments` con reserva pública controlada por reglas.
- **Ficha clínica / consultas:** `consultations` en centro y también en subcolección de paciente raíz (coexistencia de modelos).
- **Gobernanza clínica/operacional:** auditoría (`auditLogs`), preadmisiones, marketing, mensajería y backups en Functions.

### 1.3 Señales arquitectónicas relevantes
- `ViewMode` centraliza navegación de múltiples portales (home, paciente, profesional, admin, superadmin).
- `App.tsx` concentra routing, orquestación de auth, centro activo y renderizado de múltiples paneles.
- `useFirestoreSync` unifica sincronización de pacientes, staff, agenda, logs, preadmisiones y servicios.

---

## 2) Dashboards y vistas principales detectadas

### 2.1 Dashboards core
1. **DoctorDashboard** (profesional): tabs `patients`, `agenda`, `reminders`, `settings`, `performance`.
2. **AdminDashboard** (centro): tabs `command_center`, `doctors`, `agenda`, `whatsapp`, `audit`, `preadmissions`, `services`, `marketing`, `performance`.
3. **SuperAdminDashboard** (plataforma): tabs `general`, `centers`, `finanzas`, `comunicacion`, `metrics`, `users`.

### 2.2 Vistas portal/públicas y autenticación
- **Center portal** (entrada por centro) con rutas públicas de paciente.
- **Patient menu / booking / cancel / preingreso**.
- **Doctor login / Admin login / Superadmin login**.
- **Select-center** para usuarios con múltiples centros.
- **VerifyDocument**, **InvitePage**, **HomeDirectory/Landing**.

---

## 3) Flujos críticos identificados

### 3.1 Pacientes
1. Captura/edición de ficha vía `PatientForm`.
2. Escritura principal en `/patients` (owner + `accessControl.allowedUids` + `accessControl.centerIds`).
3. Archivo lógico (no hard delete) con motivo y política de retención.

**Observación:** existe modelo híbrido/legado (pacientes y consultas también bajo `centers/{centerId}` en parts del backend), elevando complejidad de consistencia.

### 3.2 Agenda
1. Staff/admin/doctores gestionan slots en `centers/{centerId}/appointments`.
2. Flujo público permite leer horas `available` y reservar transición `available → booked` sin autenticación.
3. `useFirestoreSync` carga agenda sin queries complejas y filtra/sortea client-side.

### 3.3 Ficha clínica
1. Consultas clínicas y detalle en componentes clínicos (historial, impresión, reportes).
2. Reglas permiten acceso por staff con lógica CARE_TEAM / CENTER_WIDE.
3. Existen rutas de migración y reconciliación de pacientes/consultas en Cloud Functions.

### 3.4 Autenticación
1. Login email/password y Google, con resolución de roles y centros desde `/users/{uid}`.
2. Validación de claim superadmin + lista de emails permitidos para acceso superadmin.
3. Selección de centro cuando el usuario tiene múltiples centros.

### 3.5 Multi-tenant
1. Aislamiento por `centerId` en subcolecciones `centers/{centerId}/...`.
2. Paciente global comparte acceso por listas (`allowedUids`, `centerIds`).
3. Reglas Firestore separan permisos por rol (`isCenterAdmin`, `isAdministrative`, `isDoctor`, `isSuperAdmin`) y por modo de acceso del centro.

---

## 4) Top 10 riesgos iniciales (preliminar)

1. **Bypass de acceso por query params (`demo`, `agent_test`, `master_access`) en frontend.**
   - Riesgo: exposición accidental en producción si no hay hardening de build/entorno.
2. **Credenciales/identidades privilegiadas hardcodeadas (allowlist superadmin en cliente).**
   - Riesgo: superficie de enumeración y fragilidad operacional de IAM.
3. **Lectura pública de centros activos (`allow read ... || resource.data.isActive == true`).**
   - Riesgo: metadata leakage cross-tenant (inventario de centros).
4. **Reserva pública de agenda con PII mínima sin auth.**
   - Riesgo: spam de reservas, abuso de slots, contaminación operacional.
5. **Modelo de datos híbrido (root `/patients` + legado bajo `centers/{centerId}` + migraciones).**
   - Riesgo: divergencia de datos clínicos e inconsistencias de integridad.
6. **`App.tsx` monolítico (~76KB) con routing+estado+auth+UI mezclados.**
   - Riesgo: alto acoplamiento, baja mantenibilidad, mayor probabilidad de regresiones.
7. **`useFirestoreSync` centraliza demasiadas responsabilidades.**
   - Riesgo: cascadas de re-render, complejidad de permisos y debugging difícil.
8. **Carga de citas con filtros client-side y límites altos (`limit(1000)`).**
   - Riesgo: degradación de performance/costos en centros con alta demanda.
9. **Dependencia de `prompt()` para motivos de archivado en operaciones críticas.**
   - Riesgo UX/compliance: trazabilidad débil y baja calidad de dato de auditoría.
10. **Coexistencia de controles de autorización en cliente + reglas + functions.**
    - Riesgo: drift de políticas entre capas y comportamientos no deterministas por rol/escenario.

---

## 5) Recomendación: por dónde auditar primero

### Prioridad 1 — Seguridad y aislamiento multi-tenant (Semana 1)
- Revisar exhaustivamente `firestore.rules` (lecturas públicas, escalación de privilegios, validaciones por rol y por `centerId`).
- Revisar Functions críticas con side effects clínicos/administrativos (invites, auditoría, enlace paciente-profesional, backups).
- Verificar que flags de demo/master estén totalmente deshabilitados en producción (build-time/runtime).

### Prioridad 2 — Integridad clínica de datos (Semana 2)
- Definir fuente canónica única para paciente/consulta.
- Auditar rutas de migración y reconciliación de historial clínico.
- Probar escenarios de acceso cruzado por profesional/centro (CARE_TEAM vs CENTER_WIDE).

### Prioridad 3 — Performance y mantenibilidad (Semana 3)
- Segmentar `App.tsx` por bounded contexts/routing.
- Desacoplar `useFirestoreSync` por dominios (pacientes, agenda, auditoría, preadmisión).
- Endurecer estrategia de queries/indexes en agenda para reducir filtros client-side.

### Prioridad 4 — UX operativa clínica (Semana 4)
- Homologar flujos críticos (agendar/cancelar/ficha) con validaciones robustas y feedback explícito.
- Sustituir `prompt()` por formularios transaccionales auditables.
- Evaluar carga cognitiva en dashboards multirol (doctor/admin/superadmin).

---

## 6) Módulos de mayor riesgo (ranking preliminar)
1. **Auth + resolución de roles + accesos especiales.**
2. **Reglas Firestore multi-tenant + acceso público de agenda/preadmisión.**
3. **Modelo paciente/consulta híbrido (integridad clínica).**
4. **Dashboard Admin (orquesta operaciones sensibles de centro).**
5. **Dashboard SuperAdmin (operaciones globales de impacto alto).**
6. **Agenda (disponibilidad y reservas públicas).**
7. **Auditoría clínica/legal (consistencia entre cliente y functions).**
8. **Funciones de migración/estadísticas automáticas.**

