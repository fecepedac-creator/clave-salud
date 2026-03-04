---
name: "FHIR_Bridge_CL"
description: "Habilidad para mapear datos clínicos de Clave Salud al estándar HL7 FHIR Core-CL (Chile) para interoperabilidad nacional."
---

# FHIR_Bridge_CL: Puente de Interoperabilidad

Esta habilidad faculta al agente para transformar la información de Clave Salud en recursos FHIR válidos, asegurando que la plataforma esté lista para integrarse con la red nacional de salud.

## Capacidades
1. **Mapeo de Pacientes**: Transforma el objeto `Patient` local a un recurso `Patient` FHIR v4.0.1, incluyendo extensiones para RUN (RUT chileno) y Previsión (FONASA/ISAPRE).
2. **Transformación de Encuentros**: Convierte `Consultation` en recursos `Encounter` y `Observation`.
3. **Manejo de Terminologías**: Utiliza códigos DEIS para centros de salud y sistemas de codificación locales.
4. **Validación de Esquema**: Verifica que el JSON generado cumpla con los requisitos mínimos del perfil Core-CL.

## Seguridad y Privacidad
- **Integridad de Datos**: El mapeo debe ser bidireccional y sin pérdida de información crítica.
- **Anonimización Opcional**: Puede generar recursos seudonimizados si se solicita para fines de investigación.

## Herramientas
- `scripts/map_to_fhir_patient.js`: Script principal para la conversión de datos de paciente local a FHIR.

## Instrucciones de Uso
Activar cuando se pida: "Genera el FHIR de este paciente", "Prepara la integración con el MINSAL", o "¿Cómo mapeamos las consultas a estándares internacionales?".
