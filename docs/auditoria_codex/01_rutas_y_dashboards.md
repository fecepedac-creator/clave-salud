# 01 — Rutas y Dashboards: ClaveSalud

## Rutas Principales (React Router Simulation)
La plataforma gestiona las vistas de forma dinámica en `App.tsx` basándose en el prefijo de la URL:

-   `/` (Home / Directorio): Página de inicio pública para pacientes.
-   `/center/:centerId`: Portal de reserva pública y visualización básica del centro médico.
-   `/acceso-admin`: Login administrativo (Centro Admin).
-   `/accesoprofesionales` / `/pro`: Login para médicos y personal de salud.
-   `/superadmin`: Panel maestro de control (requiere email específico y claims de SuperAdmin).
-   `/verify/:patientId/:docId`: Ruta pública de verificación de documentos (Recetas, Órdenes).

## Dashboards y Funcionalidades Principales

### 1. Admin Dashboard (Admin de Centro)
-   **Ruta final:** `/center/:centerId` (tras login exitoso).
-   **Tabs principales:**
    -   `Atención Hoy`: Visualización rápida de citas del día y cambio de estado (Asiste / No Asiste).
    -   `Rendimiento`: Estadísticas del centro, KPIs financieros y cierre contable mensual.
    -   `Agenda`: Vista completa de disponibilidad y reserva de horas manual.
    -   `Staff`: Listado de profesionales, configuración de agendas y edición de info pública.
    -   `Configuración`: Opciones de marketing, activadores de IA y ajustes del portal.
-   **Botones Críticos:**
    -   `Cierre de Mes`: Finaliza el período y bloquea cambios.
    -   `Nueva Invitación Staff`: Genera link de acceso para un nuevo médico.

### 2. Doctor Dashboard (Profesional de Salud)
-   **Ruta final:** `/pro/center/:centerId`.
-   **Tabs principales:**
    -   `Pacientes`: Buscador y listado completo de carterización de pacientes.
    -   `Agenda`: Su calendario personal de atenciones.
    -   `Rendimiento`: KPIs personales (¿cuánto he atendido?, ¿cuánto he facturado?).
    -   `Configuración`: Ajuste de perfil, subida de foto y plantillas clínicas personales.
-   **Funcionalidad en Ficha Clínica:**
    -   `Nueva Consulta`: Modal para registro de evoluciones (Anamnesis, Examen Físico, Plan).
    -   `Generar Receta / Orden`: Exportación a PDF con QR de verificación.
    -   `Control PSCV`: Flujo especializado para seguimiento cardiovascular.

### 3. SuperAdmin Dashboard
-   **Ruta final:** `/superadmin`.
-   **Módulos:**
    -   `Gestión de Centros`: Crear, editar y suspender centros médicos.
    -   `Facturación UF`: Configuración del costo mensual por centro en UF.
    -   `Catálogo de Exámenes`: Gestión centralizada de perfiles (Sangre, Orina, Imágenes).
    -   `Modo Preview`: Permite al SuperAdmin "imitar" a un médico o admin de cualquier centro para soporte técnico.

## Requisitos de Login
| Módulo             | Requiere Login | Roles Permitidos                            |
|-------------------|----------------|---------------------------------------------|
| Inicio / Directorio| No             | Público                                     |
| Portal Reserva    | No             | Público                                     |
| Dashboard Admin   | Sí             | `admin_centro`, `super_admin`               |
| Dashboard Doctor  | Sí             | `MEDICO`, `PODOLOGO`, `KINE`, etc.          |
| SuperAdmin Panel  | Sí             | Únicamente `super_admin` (emails filtrados) |
| Verificación QR   | No             | Público                                     |
