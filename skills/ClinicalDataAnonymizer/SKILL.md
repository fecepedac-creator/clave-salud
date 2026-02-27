---
name: "ClinicalDataAnonymizer"
description: "Habilidad para la seudonimización y anonimización de registros clínicos bajo estándares internacionales (ISO 25237), permitiendo el análisis de datos sin comprometer la identidad del paciente."
---

# ClinicalDataAnonymizer: Privacidad de Datos Clínicos

Esta habilidad permite al asistente procesar información de salud eliminando o enmascarando Información de Identificación Personal (PII), asegurando que Clave Salud cumpla con los más altos estándares de privacidad.

## Capacidades
1. **Identificación de PII**: Reconoce campos sensibles como RUT, Nombres, Apellidos, Teléfonos, Correos y Direcciones Exactas.
2. **Seudonimización**: Reemplaza identificadores reales por IDs sintéticos que permiten mantener la relación entre registros sin revelar la identidad (útil para estudios longitudinales).
3. **Anonimización Irreversible**: Elimina completamente los datos identificatorios para reportes estadísticos públicos o de SuperAdmin.
4. **Preservación Clínica**: Asegura que los datos clínicos (diagnósticos, valores de laboratorio, constantes vitales) no se alteren durante el proceso de privacidad.

## Seguridad y Privacidad
- **Cumplimiento ISO 25237**: Sigue los principios de informática en salud para la protección de la privacidad.
- **Sin Re-identificación**: Minimiza el riesgo de que los datos puedan ser vinculados nuevamente a un individuo mediante ataques de inferencia.

## Herramientas
- `scripts/anonymize_patient_data.js`: Script para procesar objetos de paciente y generar versiones seguras.

## Instrucciones de Uso
Activar cuando se pida: "Genera un reporte de diagnósticos por centro", "Exporta datos para investigación", o "Muestra estadísticas de pacientes sin revelar sus nombres".
