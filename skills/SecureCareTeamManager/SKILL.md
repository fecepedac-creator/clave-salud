---
name: "SecureCareTeamManager"
description: "Habilidad para gestionar dinámicamente el acceso a fichas clínicas mediante el concepto de Care Teams (Equipos de Cuidado)."
---

# SecureCareTeamManager: Gestión Dinámica de Accesos

Esta habilidad permite al agente administrar de forma granulada quién tiene permiso para ver y editar la información de un paciente, basándose en la colaboración clínica activa.

## Capacidades
1. **Gestión de Care Teams**: Capacidad para agregar o eliminar UIDs en el campo `careTeamUids` de un paciente.
2. **Auditoría de Acceso**: Verifica si un profesional específico tiene derecho a ver una ficha basándose en las reglas de negocio (dueño, equipo de cuidado o administrador).
3. **Revocación Automática**: Lógica para proponer la eliminación de un profesional de un equipo de cuidado tras la finalización de un tratamiento o interconsulta.
4. **Sincronización con Firestore**: Asegura que los cambios en el equipo de cuidado se reflejen en tiempo real para las `firestore.rules`.

## Seguridad y Privacidad
- **Privilegio Mínimo**: Solo se debe agregar a un profesional si existe una razón clínica documentada.
- **Trazabilidad**: Cada cambio en el equipo de cuidado constituye un evento de auditoría mayor.
- **Aislamiento Multi-inquilino**: Garantiza que los miembros del equipo pertenezcan al mismo `centerId` o tengan convenios inter-centro válidos.

## Instrucciones de Uso
Activar cuando se pida: "Dale acceso al Dr. Soto a la ficha de este paciente", "Crea un equipo de cuidado para el paciente Y", o "Revoca los accesos temporales de este mes".
