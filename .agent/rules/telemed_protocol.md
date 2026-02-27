# Regla: Protocolo de Telemedicina (NCh3442)

- **Consentimiento Mandatorio**: El agente no debe considerar finalizada una consulta de telemedicina si el campo `telemedConsent` es falso o está ausente.
- **Etiquetado de Origen**: Toda nota o prescripción generada en una atención remota debe incluir el prefijo "[TELEMEDICINA]" o estar vinculada a una sesión validada por esta skill.
- **Validación de Capacidad**: Antes de sugerir planes de tratamiento complejos, el agente debe verificar si el profesional ha indicado que la evaluación física remota fue suficiente según la NCh3442.
- **Activación de Skill**: El agente debe activar `TelemedProtocolAssistant` siempre que detecte que el atributo `isRemote` o `type == "telemedicine"` está presente en la cita o consulta.
