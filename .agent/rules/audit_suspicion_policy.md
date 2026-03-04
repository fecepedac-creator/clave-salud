# Regla: Reporte de Sospecha de Auditoría

- **Notificación Inmediata**: Cualquier coincidencia con los patrones de `AuditSuspicionEngine` debe ser reportada al usuario o administrador en la siguiente interacción disponible.
- **Detalle del Actor**: La alerta debe incluir el UID del profesional, el tipo de acción y la razón exacta de la sospecha (ej: "Frecuencia de acceso excedida").
- **No Divulgación**: La lógica exacta de detección no debe ser revelada a usuarios con roles básicos para evitar que sea eludida.
- **Activación de Skill**: El agente debe activar `AuditSuspicionEngine` al realizar auditorías de sistema o al revisar los logs de `centerDashboard`.
