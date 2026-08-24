# Candidato de staging A-F — 2026-08-23

## Alcance

- Rama local: `codex/release-integration-af`
- Tag local del candidato: `codex-release-af-staging-candidate-20260824-v3`
- Base reversible: `5518680c770c6b18924dfe95b057535387c977d5`
- Candidato funcional A-F: `89f6508b9414a38b2acdc31f8c6ec655c6024878`; los commits posteriores agregan únicamente manifiesto y guardrails de liberación.
- Estado: solo local; sin push, PR ni despliegue a producción.

## Trenes incluidos

1. A — base visual segura de dashboards.
2. B — continuidad y operaciones transaccionales de agenda.
3. D — perfiles profesionales, capacidades y recursos de agenda separados.
4. E — minimización demográfica, auditoría y soporte acotado.
5. C — borrador, firma, inmutabilidad y adenda clínica.
6. F — protección del portal público, portal privado publicado, recordatorios idempotentes y contrato de calendario deshabilitado por defecto.

## Gates ejecutados

- Build Vite y `tsc --noEmit` de la aplicación.
- Build y `tsc --noEmit` de Functions.
- 89/89 pruebas frontend con Vitest.
- 71/71 pruebas unitarias de Functions; suites de emulador separadas.
- 24/24 pruebas de Firestore Rules.
- Integraciones de agenda, directorio, documentos clínicos, portal y recordatorios con Firestore Emulator.
- Gate de navegador autenticado: cita → borrador → recarga → firma → adenda; recepción denegada.
- Recorridos desktop/mobile de profesional, administración, superadmin, agenda, profesiones y recursos.
- El gate `npm run test:e2e:release-smoke` fuerza un servidor fresco y aislado; no reutiliza otro localhost abierto.
- Escaneo local de secretos sin hallazgos y 14 controles comerciales verificados.
- Ensayo de rollback: la base `5518680` se instaló y pasó build/TypeScript de aplicación y Functions en un worktree temporal aislado; el worktree se retiró después de validar.

## Secuencia de staging

1. Configurar en `.firebaserc` un alias `staging` que apunte a un proyecto distinto de `clavesalud-2`.
2. Registrar una sola aplicación web en el proyecto staging. El build obtiene su configuración con Firebase CLI únicamente en memoria y fuerza inicialmente las integraciones de riesgo a `false`; no usa ni persiste `.env.staging.local`.
3. Ejecutar `npm run release:staging:preflight`; debe rechazar un worktree sucio, otra rama, el alias `default`, cualquier destino de producción y una aplicación web que no pertenezca a staging.
4. Crear staging desde este commit exacto, sin mezclar cambios de otros worktrees.
5. Aplicar primero Hosting con `npm run release:staging:hosting`; este usa `vite build --mode staging`, y después ejecutar los recorridos públicos y simulados.
6. Aplicar Rules y Functions, en ese orden, con los comandos `release:staging:*`; todos incluyen el mismo preflight.
7. Repetir Rules, integraciones y gate autenticado contra staging con cuentas sintéticas.
8. Mantener deshabilitados Calendar y el portal privado hasta provisionar identidad o grants seguros.
9. Observar errores, latencia y auditoría antes de promover por tren; no promover A-F en un único salto.

## Rollback

- Rollback total: volver al commit base `5518680c770c6b18924dfe95b057535387c977d5` y redesplegar los artefactos de staging desde esa revisión.
- Rollback parcial: revertir los commits del último tren promovido en orden inverso y repetir build, Rules y smokes.
- No borrar ni migrar datos para revertir. Las nuevas colecciones son aditivas y las integraciones externas permanecen deshabilitadas por defecto.
- Producción queda bloqueada hasta comprobar staging, cuentas autenticadas reales de prueba y el rollback del artefacto desplegado.

## Observaciones no bloqueantes

- Node local es 24 y el runtime declarado de Functions es 20; los gates pasan, pero staging debe usar el runtime declarado.
- Browserslist y `firebase-functions` informan versiones antiguas; no se actualizaron dentro de este release para evitar ampliar el alcance.
- El lint lógico pasa; la regla Prettier detecta CRLF del checkout Windows y no se hizo una normalización masiva.
