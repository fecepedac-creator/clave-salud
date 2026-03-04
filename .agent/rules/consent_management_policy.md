# Regla: Gestión de Consentimiento Clínico

- **Verificación Pre-Acción**: Antes de sugerir una atención de telemedicina o una exportación FHIR, el agente debe verificar que el paciente tenga el consentimiento correspondiente marcado como `active`.
- **Protección Oncológica (Ley 21.656)**: Si se detecta un paciente con antecedentes oncológicos que cumple el criterio de tiempo (5 años post-tratamiento), el agente debe aplicar la Skill `PatientConsentManager` para omitir dicha información en reportes de seguros o laborales.
- **Registro de Revocación**: Si un paciente solicita revocar un permiso, el agente debe guiar al profesional para marcar el registro con un timestamp y motivo, asegurando la trazabilidad.
- **Activación de Skill**: El agente debe activar `PatientConsentManager` en cada inicio de consulta y antes de cualquier proceso de intercambio de datos externos.
