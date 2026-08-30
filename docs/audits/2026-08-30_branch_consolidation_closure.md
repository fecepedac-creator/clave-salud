# Cierre de consolidación de ramas — 2026-08-30

## Alcance y criterio

Esta revisión compara todas las ramas remotas no incorporadas por ascendencia a
`origin/main` en el corte `226bfe2`. Una rama no se mezcla de forma completa solo
por aparecer como `--no-merged`: se revisan sus archivos, su antigüedad, las
implementaciones equivalentes posteriores y el riesgo de reintroducir código
revertido o contratos obsoletos.

Estados utilizados:

- **Integrada selectivamente**: la mejora vigente ya se rescató en `main`.
- **Superada**: `main` contiene una implementación equivalente y posterior.
- **Histórica**: conserva evidencia o propuestas, pero su código no debe volver
  al producto canónico.

## Resultado por rama pendiente

| Rama remota | Estado | Evidencia y decisión |
| --- | --- | --- |
| `codex/conduct-system-audit-for-clavesalud` | Superada | Los artefactos de auditoría útiles ya están en `main`; las Rules canónicas son posteriores y pasaron su limpieza y validación. No mezclar el parche antiguo de Rules. |
| `codex/implement-app-legal-documents-and-policies-9uyhxl` | Superada | Las vistas legales, enlaces y onboarding existen en versiones posteriores. El `public/sw.js` aislado corresponde a una estrategia PWA antigua y no se reincorpora. |
| `codex/implement-patient-consent-and-opt-out-features` | Integrada selectivamente | El consentimiento y opt-out vigentes fueron reimplementados, probados y publicados mediante PR #130, incluyendo auditoría y validación de Rules. |
| `codex/release-exam-matrix` | Integrada selectivamente | La matriz y el flujo de exámenes vigentes están en `main` mediante la consolidación del flujo de paciente nuevo/exámenes. La rama contiene una versión anterior. |
| `codex/release-integration-af` | Integrada selectivamente | La mayoría de sus archivos son idénticos o fueron superados. Los componentes de addenda/estado ausentes habían sido revertidos deliberadamente; los scripts antiguos de promoción imponían una convención de rama ya reemplazada por el flujo de staging y confirmación explícita. |
| `codex/review-chatbot-configuration-in-clave-salud-repo` | Superada | Su `whatsapp.ts` tiene 1.838 líneas frente a 2.741 en `main`; después se incorporaron validación de firma, MFA, TTL, transacciones, recordatorios e idempotencia. La propuesta V2 queda como referencia histórica, no como código para mezclar. |
| `codex/review-clave-salud-project` | Superada | El generador de auditorías fue incorporado y posteriormente depurado. Los resultados de muestra de marzo no forman parte del estado operativo actual. |
| `codex/review-clave-salud-project-557s9w` | Superada | Misma línea de auditoría; `main` conserva la versión limpia y sin marcadores de conflicto mediante PR #129. |
| `codex/revisar-cambios-sugeridos` | Integrada selectivamente | Se rescató la visualización del examen físico mediante PR #131. El resto es un refactor arquitectónico antiguo y acoplado: incluye alternativas de sincronización, desafíos públicos y confirmaciones críticas que divergen de los contratos canónicos posteriores. No se mezcla en bloque. |
| `copilot/fix-missing-roles-selector` | Superada | Los roles y capacidades vigentes ya existen; el cálculo de edad y los formularios canónicos son posteriores. |
| `copilot/fix-tailwind-colors-buttons` | Superada | `main` ya contiene la paleta, `LogoHeader` con imagen y fallback, y `formatPersonName` modular. La rama antigua duplica `formatPersonName` en el mismo archivo y reemplazaría pantallas posteriores. |
| `fix/print-preview-blank` | Superada | La corrección validada de impresión/PDF/Word está en `main`; el parche antiguo ocultaba `#root`, contrario al mecanismo de impresión que quedó probado. |

## Estado operativo del runtime

- Staging `clavesalud-staging-20260824`: **37/37** funciones `ACTIVE` en
  `nodejs22`; **0** en Node 20.
- Producción `clavesalud-2`: **81/81** funciones `ACTIVE` en `nodejs22`; **0**
  en Node 20.
- La promoción se realizó por lotes aislados: agenda, directorio de pacientes,
  ciclo clínico, soporte, invitaciones, auditoría, administración y portal.
- Los callables comprobados sin autenticación respondieron 401 o 403. Las
  funciones con validación de argumentos previa respondieron 400 sin ejecutar
  operaciones autorizadas.

## Conclusión

No queda una rama remota pendiente que deba fusionarse completa. Las mejoras
vigentes identificadas se integraron selectivamente; las diferencias restantes
son versiones antiguas, propuestas históricas o refactors incompatibles con los
contratos canónicos posteriores. Las ramas se preservan por ahora como evidencia
y no se eliminan en este cierre.

## Validación canónica posterior al cierre

- Vitest quedó separado de Jest, Playwright y Rules para evitar descubrimiento
  cruzado: **30 archivos, 104/104 pruebas aprobadas**.
- Jest de Functions: **10 suites aprobadas, 71/71 pruebas ejecutadas**; 28
  pruebas de integración quedan condicionadas al emulador por diseño.
- Firestore Rules en Emulator Suite: **26/26 pruebas aprobadas**.
- Build web Vite y build TypeScript de Functions: aprobados.
- Escaneo de secretos: sin hallazgos.
- Preparación comercial: 14 controles aprobados.
- Verificación operacional: **15/15 controles aprobados**, incluidos backups,
  retención, secretos desplegados, proyecto de recuperación y roles canónicos.
- Dependencias actualizadas dentro de sus rangos compatibles. `npm audit
  --omit=dev` pasó de incluir hallazgos críticos/altos a **0 críticos, 0 altos y
  8 moderados**. Los moderados restantes provienen de Firebase Admin 13 y sus
  dependencias Google; Firebase Admin 14 requiere una migración separada de la
  API namespaced y no se fuerza dentro de este cierre.
