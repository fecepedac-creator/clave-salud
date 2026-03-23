# Multiagente — Auditorías por área

Este paquete define prompts listos para ejecutar auditorías por área usando múltiples agentes en paralelo.

## Archivos

- `ORQUESTADOR_PROMPT.md`: prompt maestro para coordinar los agentes, consolidar y priorizar hallazgos.
- `AGENTES_PROMPTS.md`: prompts especializados por área (1 agente por área).
- `SALIDA_ESTANDAR.md`: formato único obligatorio para que todos los agentes entreguen resultados comparables.

## Flujo recomendado

1. Ejecuta el **Orquestador** con el objetivo de auditoría y horizonte de tiempo.
2. Dispara los **7 agentes** (uno por área) en paralelo usando sus prompts.
3. Obliga a cada agente a usar `SALIDA_ESTANDAR.md`.
4. El Orquestador deduplica hallazgos, calcula severidad y propone backlog.

## Áreas cubiertas

1) Capa transversal de acceso y tenancy.
2) SuperAdmin Dashboard.
3) Admin Center Dashboard.
4) Doctor Dashboard (núcleo).
5) Subvistas por profesional (`features/doctor`).
6) Canales automáticos y bots (WhatsApp / Functions).
7) Portal paciente / booking público.
