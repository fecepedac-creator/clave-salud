# 05 — Archivos Clave del Proyecto: ClaveSalud

Esta es la lista de archivos más importantes para entender el sistema y comenzar una auditoría técnica profunda:

## Core & Routing
-   **`c:\Users\fecep\clave-salud\App.tsx`**
    -   *Explicación:* Punto de entrada principal. Contiene toda la lógica de rutas, detección de roles y renderizado de dashboards mediante carga Diferida (Lazy Loading).
-   **`c:\Users\fecep\clave-salud\types.ts`**
    -   *Explicación:* Definición de todas las interfaces TypeScript (Patient, Doctor, Appointment, Clinic, etc.). Es la Biblia de datos del proyecto.

## Seguridad & Auth
-   **`c:\Users\fecep\clave-salud\firestore.rules`**
    -   *Explicación:* Reglas maestras de Firebase. Crucial para entender cómo se aísla la información entre centros (Multi-tenancy) y quién puede leer qué.
-   **`c:\Users\fecep\clave-salud\hooks\useAuth.ts`**
    -   *Explicación:* Lógica de inicio de sesión, persistencia de perfil de usuario y gestión de claims de SuperAdmin.
-   **`c:\Users\fecep\clave-salud\utils\roles.ts`**
    -   *Explicación:* Funciones auxiliares para verificar permisos y roles dentro de la aplicación.

## Gestión de Datos (Hooks)
-   **`c:\Users\fecep\clave-salud\hooks\useFirestoreSync.ts`**
    -   *Explicación:* Orquestador de sincronización en tiempo real con Firestore para Pacientes, Doctores y Citas de un centro específico.
-   **`c:\Users\fecep\clave-salud\hooks\useBooking.ts`**
    -   *Explicación:* Manejo del flujo de reserva de horas, incluyendo transacciones atómicas para evitar doble sobre-cupo.

## Dashboards (UI & Lógica Operativa)
-   **`c:\Users\fecep\clave-salud\components\AdminDashboard.tsx`**
    -   *Explicación:* Implementación de toda la operativa administrativa (KPIs, Staff, Agenda). Contiene pestañas críticas y lógica de cierre de mes.
-   **`c:\Users\fecep\clave-salud\components\DoctorDashboard.tsx`**
    -   *Explicación:* Interfaz de atención médica, registro de fichas clínicas e integración de perfiles de exámenes.

## Testing & Audit
-   **`c:\Users\fecep\clave-salud\playwright.config.ts`**
    -   *Explicación:* Configuración global de la suite de pruebas E2E.
-   **`c:\Users\fecep\clave-salud\tests\auth\auth.setup.ts`**
    -   *Explicación:* El archivo más complejo de testing. Logra persistir sesiones en IndexedDB para automatización.
-   **`c:\Users\fecep\clave-salud\scripts\audit_isolation_fixed.cjs`**
    -   *Explicación:* Script de auditoría server-side para validar huérfanos y asegurar que no haya fuga de datos entre centros.

## Integración Externa
-   **`c:\Users\fecep\clave-salud\firebase.ts`**
    -   *Explicación:* Configuración técnica de conexión con el backend de Firebase (SDK 9/10).
-   **`c:\Users\fecep\clave-salud\vite.config.ts`**
    -   *Explicación:* Configuración del bundler, proxy de entorno y optimización de chunks.
