# Formato estándar de salida por agente

> Uso obligatorio en todas las auditorías por área.

## 1) Resumen Ejecutivo
- Estado general: `SANO | RIESGO_MEDIO | RIESGO_ALTO`
- Total hallazgos: `N`
- Hallazgos críticos/altos: `N`

## 2) Alcance auditado
- Archivos revisados
- Flujos cubiertos
- Límites (fuera de alcance)

## 3) Hallazgos (tabla)
| ID | Severidad | Área | Riesgo | Impacto | Evidencia |
|---|---|---|---|---|---|
| H-001 | Crítica/Alta/Media/Baja | [área] | [resumen] | [impacto] | [archivo + líneas] |

## 4) Hallazgos detallados
### H-001 - [título]
- **Severidad:**
- **Descripción:**
- **Impacto:**
- **Probabilidad:**
- **Reproducción:**
- **Evidencia técnica:**
- **Recomendación (sin implementar):**
- **Prioridad:** `P0 | P1 | P2`

## 5) Cobertura de pruebas y brechas
- Qué pruebas existentes cubren el área.
- Qué escenarios no están cubiertos.

## 6) Riesgos priorizados
- `P0`: 
- `P1`:
- `P2`:

## 7) Evidencia operativa
- Comandos ejecutados.
- Resultados principales (pass/fail/warn).
