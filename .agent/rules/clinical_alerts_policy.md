# Regla: Política de Alertas Clínicas

- **Priorización de Alertas**: Si al revisar una ficha el agente detecta un valor fuera de los umbrales de `BioMarkerGuardian`, debe informarlo inmediatamente al profesional al inicio de la respuesta.
- **Referencia Normativa**: Toda alerta clínica debe mencionar la guía o protocolo del MINSAL (ej: GES, AUGE, Guías de Práctica Clínica) en la que se basa.
- **Claridad y Acción**: La alerta debe ser clara (ej: "VALOR CRÍTICO: HbA1c 10.5%") y sugerir la acción recomendada por el protocolo.
- **Activación de Skill**: El agente debe activar `BioMarkerGuardian` siempre que trabaje con módulos de visualización de exámenes, gráficos de tendencias o resúmenes de pacientes.
