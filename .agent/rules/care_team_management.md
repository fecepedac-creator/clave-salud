# Regla: Gestión de Equipos de Cuidado (Care Teams)

- **Principio de Colaboración**: El acceso a la ficha clínica debe ser dinámico y limitado a los profesionales que participan activamente en el cuidado del paciente.
- **Registro Obligatorio**: Cada vez que se modifique un `careTeamUids`, se debe registrar el `actorUid` y la razón del cambio en los metadatos del paciente o en el log de auditoría.
- **Consistencia de Datos**: Los UIDs agregados al equipo de cuidado deben ser validados contra el directorio de staff del centro correspondiente para evitar accesos externos no autorizados.
- **Revisión Periódica**: El agente debe sugerir la revisión de los equipos de cuidado en pacientes con consultas inactivas por más de 6 meses.
