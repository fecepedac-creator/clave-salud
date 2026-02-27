# Regla: Interoperabilidad FHIR

- **Estándar Obligatorio**: Todas las nuevas APIs de exportación o integración con terceros deben utilizar el estándar **HL7 FHIR Core-CL**.
- **Activación de Skill**: El agente debe activar `FHIR_Bridge_CL` siempre que trabaje en módulos de comunicación externa de datos clínicos.
- **Validación de Esquema**: No se permiten exportaciones de datos que no hayan sido validadas contra la estructura técnica definida en la habilidad.
- **Documentación de Mapeo**: Cualquier cambio en el modelo de datos interno (`types.ts`) debe reflejarse inmediatamente en las reglas de mapeo de la habilidad FHIR_Bridge_CL.
