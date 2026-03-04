---
name: "BioMarkerGuardian"
description: "Habilidad para monitorear biomarcadores y constantes vitales, activando alertas clínicas basadas en las Guía de Práctica Clínica del MINSAL (Chile)."
---

# BioMarkerGuardian: Vigilancia Clínica Proactiva

Esta habilidad capacita al asistente para identificar valores críticos en la historia clínica del paciente, facilitando la detección temprana de descompensaciones.

## Capacidades
1. **Monitoreo de Diabetes**: Detecta HbA1c > 9.0% o glicemias en ayunas críticas según guía GES de Diabetes Mellitus Tipo 2.
2. **Vigilancia Cardiovascular**: Alertas por Presión Arterial > 140/90 mmHg de forma persistente (Guía Hipertensión Arterial).
3. **Función Renal**: Identifica caídas en la TFG (Tasa de Filtración Glomerular) < 60 ml/min/1.73m² (Enfermedad Renal Crónica).
4. **Contextualización GES/AUGE**: Cita la normativa específica chilena al generar una alerta para respaldar la decisión clínica.

## Seguridad y Privacidad
- **No es Sustituto de Juicio Clínico**: Las alertas son sugerencias para el profesional y deben ser validadas en el contexto del paciente.
- **Acceso a Exámenes**: Solo analiza datos del paciente en consulta actual o historial relevante autorizado.

## Herramientas
- `scripts/validate_biomarkers.js`: Script para procesar resultados de laboratorio y signos vitales contra umbrales de alerta.

## Instrucciones de Uso
Activar cuando se pida: "¿Cómo están los niveles de este paciente?", "Revisa si hay algún valor crítico en los exámenes", o "Aplica las reglas BioMarkerGuardian a la ficha de X".
