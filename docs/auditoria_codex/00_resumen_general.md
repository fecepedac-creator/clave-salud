# 00 — Resumen General: ClaveSalud

## ¿Qué es ClaveSalud?
ClaveSalud es una plataforma integral de gestión clínica y administrativa diseñada para centros médicos y profesionales de la salud. Permite centralizar la ficha clínica, la agenda de pacientes, la reportería de rendimiento y la interoperabilidad semántica (estándares como FHIR y SNOMED-CT).

## Módulos Principales
1.  **Ficha Clínica:** Registro detallado de pacientes, antecedentes médicos/quirúrgicos, y evoluciones (consultas).
2.  **Agenda y Reservas:** Sistema de gestión de horas presenciales y portal público de reserva para pacientes.
3.  **Rendimiento y KPIs:** Dashboards para médicos y administradores que muestran estadísticas de atención, inasistencias y montos facturables.
4.  **Multi-tenancy:** Aislamiento estricto de datos entre diferentes centros médicos dentro de la misma infraestructura.
5.  **Marketing y Fidelización:** Herramientas para generación de banners informativos, flyers con IA y comunicación vía WhatsApp.

## Dashboards Disponibles
- **SuperAdmin Dashboard:** Gestión global de la plataforma (centros, facturación, plantillas base).
- **Admin Dashboard (Administración de Centro):** Operación diaria del centro, control de staff, finanzas y configuración local.
- **Doctor Dashboard (Profesional):** Ficha clínica, agenda personal y seguimiento de pacientes.

## Roles del Sistema
- **SuperAdmin:** Acceso total a todos los centros y configuraciones maestras.
- **Admin (Centro):** Gestión completa de un centro médico específico.
- **Doctor / Profesional:** Acceso a ficha clínica y agenda. Se subdivide en especialidades (Médico, Podólogo, Kinesiólogo, etc.).
- **Administrativo / Secretaria:** Gestión de agenda y pacientes sin necesariamente acceder a la ficha clínica profunda (dependiendo de la configuración).
- **Paciente (Público):** Acceso solo al portal de reservas y visualización de documentos verificables (QR).

## Entorno Actual
- **Local:** React + Vite corriendo en `http://localhost:5175`.
- **Test:** Suite de Playwright configurada para validar flujos críticos sobre el entorno local o de staging.
- **Base de Datos:** Firebase (Firestore) en tiempo real para sincronización de estados.
- **Auth:** Firebase Authentication con soporte para Email/Password y Google Login.
