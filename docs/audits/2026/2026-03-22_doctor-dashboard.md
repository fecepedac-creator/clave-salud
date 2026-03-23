# Auditoría automática — Doctor Dashboard

- **Área:** `doctor-dashboard`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **ALTO RIESGO**

## Resumen de resultados

- ✅ Pass: **1**
- ❌ Fail: **2**
- ⚠️ Warning: **0**

## Alcance recomendado del área

Flujos clínicos, agenda, rendimiento individual y gestión de pacientes por profesional.

### Puntos de foco
- Acceso de profesional y resolución de identidad
- Aislamiento de cartera y métricas
- Flujos clínicos críticos (PSCV)
- Consistencia de agenda y actualizaciones

### Evidencia de código a revisar
- `components/DoctorDashboard.tsx`
- `features/doctor/components/DoctorPatientsListTab.tsx`
- `features/doctor/components/DoctorAgendaTab.tsx`
- `features/doctor/components/DoctorPatientRecord.tsx`
- `tests/doctor/login.spec.ts`
- `tests/doctor/performance-tab.spec.ts`
- `tests/doctor/pscv-flow.spec.ts`

## Ejecuciones automáticas

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npm run build` | 2026-03-22T21:37:28.584Z | 2026-03-22T21:37:38.726Z |
| ❌ FAIL | `npx playwright test tests/doctor/login.spec.ts --reporter=line` | 2026-03-22T21:37:38.726Z | 2026-03-22T21:37:38.726Z |
| ❌ FAIL | `npx playwright test tests/doctor/performance-tab.spec.ts --reporter=line` | 2026-03-22T21:37:38.726Z | 2026-03-22T21:37:38.726Z |

## Evidencia de salida

### ✅ npm run build

```text
> ficha-clínica-electrónica--dr-felipe-cepeda@0.0.0 build
> vite build

vite v6.4.1 building for production...
transforming...
✓ 2106 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                0.88 kB │ gzip:   0.42 kB
dist/assets/index-BGqxSdXN.css               118.86 kB │ gzip:  18.11 kB
dist/assets/templates-ycbpQ0iN.js              0.34 kB │ gzip:   0.22 kB
dist/assets/examOrderCatalog-TXdJpgBn.js       4.14 kB │ gzip:   1.47 kB
dist/assets/vendor-uS-d4TUT.js                11.92 kB │ gzip:   4.25 kB
dist/assets/PatientForm-CZl24OFA.js           22.25 kB │ gzip:   5.90 kB
dist/assets/purify.es-CFh60W_8.js             22.77 kB │ gzip:   8.79 kB
dist/assets/browser-Bdxs9EOp.js               25.39 kB │ gzip:   9.97 kB
dist/assets/MarketingFlyerModal-DHoZ9ZI1.js   56.97 kB │ gzip:  15.93 kB
dist/assets/SuperAdminDashboard-dsVnP5gq.js   71.41 kB │ gzip:  17.15 kB
dist/assets/AdminDashboard-HmWFptm3.js       137.12 kB │ gzip:  34.04 kB
dist/assets/index.es-CqViaiZx.js             159.51 kB │ gzip:  53.50 kB
dist/assets/html2canvas.esm-QH1iLAAe.js      202.38 kB │ gzip:  48.04 kB
dist/assets/DoctorDashboard-B5stY1NY.js      323.82 kB │ gzip:  85.09 kB
dist/assets/index-DdIkfk5w.js                339.31 kB │ gzip: 101.36 kB
dist/assets/jspdf.es.min-CvBBgz5P.js         390.53 kB │ gzip: 128.65 kB
dist/assets/firebase-BcxoqvZe.js             543.02 kB │ gzip: 127.52 kB
dist/assets/ui-B58arjGI.js                   872.18 kB │ gzip: 161.70 kB
✓ built in 9.47s
```

### ❌ npx playwright test tests/doctor/login.spec.ts --reporter=line

```text
Playwright preflight falló y --require-playwright está activo.
```

**stderr/error**

```text
browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
║                                                                         ║
║ <3 Playwright Team                                                      ║
╚═════════════════════════════════════════════════════════════════════════╝
Sugerencia: npx playwright install
```

### ❌ npx playwright test tests/doctor/performance-tab.spec.ts --reporter=line

```text
Playwright preflight falló y --require-playwright está activo.
```

**stderr/error**

```text
browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell
╔═════════════════════════════════════════════════════════════════════════╗
║ Looks like Playwright Test or Playwright was just installed or updated. ║
║ Please run the following command to download new browsers:              ║
║                                                                         ║
║     npx playwright install                                              ║
║                                                                         ║
║ <3 Playwright Team                                                      ║
╚═════════════════════════════════════════════════════════════════════════╝
Sugerencia: npx playwright install
```

## Hallazgos detectados automáticamente

- [ ] **H-001** (ALTA)
  - Comando: `npx playwright test tests/doctor/login.spec.ts --reporter=line`
  - Motivo: Comando falló durante la auditoría.
  - Recomendación: Instalar navegadores y re-ejecutar E2E: `npx playwright install`.
- [ ] **H-002** (ALTA)
  - Comando: `npx playwright test tests/doctor/performance-tab.spec.ts --reporter=line`
  - Motivo: Comando falló durante la auditoría.
  - Recomendación: Instalar navegadores y re-ejecutar E2E: `npx playwright install`.

## Hallazgos manuales posteriores

> Completar con revisión funcional/seguridad específica del área.

- [ ] M-001
- [ ] M-002
- [ ] M-003

## Metadata de archivo

- **Ruta del reporte:** `docs/audits/2026/2026-03-22_doctor-dashboard.md`
- **Timestamp generado:** `2026-03-22T21:37:38.726Z`

