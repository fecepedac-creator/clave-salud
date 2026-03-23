# Auditoría automática — SuperAdmin Dashboard

- **Área:** `superadmin`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **ALTO RIESGO**

## Resumen de resultados

- ✅ Pass: **1**
- ❌ Fail: **1**
- ⚠️ Warning: **0**

<<<<<<< HEAD
## Alcance del área

Gobernanza global, preview multi-centro y gestión de tenant.

### Puntos de foco
- Claims de superadmin
- Preview cross-center
- Listado de centros
- Aislamiento de datos

### Evidencia revisada
- `components/SuperAdminDashboard.tsx`
- `App.tsx`
- `hooks/useAuth.ts`

## Ejecuciones

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npm run build` | 2026-03-22T13:22:35.870Z | 2026-03-22T13:22:55.793Z |
| ❌ FAIL | `npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line` | 2026-03-22T13:22:55.793Z | 2026-03-22T13:24:09.843Z |

## Detalle de salida
=======
## Alcance recomendado del área

Gobernanza global, preview multi-centro, métricas globales y operaciones de centros.

### Puntos de foco
- Acceso y claims de superadmin
- Preview cross-center y salida de preview
- Operaciones globales de centros y comunicaciones
- Aislamiento multi-tenant

### Evidencia de código a revisar
- `components/SuperAdminDashboard.tsx`
- `App.tsx`
- `hooks/useAuth.ts`
- `hooks/useCenters.ts`
- `tests/admin/superadmin-audit.spec.ts`

## Ejecuciones automáticas

| Estado | Comando | Inicio | Fin |
|---|---|---|---|
| ✅ PASS | `npm run build` | 2026-03-22T21:37:59.462Z | 2026-03-22T21:38:09.336Z |
| ❌ FAIL | `npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line` | 2026-03-22T21:38:09.337Z | 2026-03-22T21:38:09.337Z |

## Evidencia de salida
>>>>>>> pr-104

### ✅ npm run build

```text
> ficha-clínica-electrónica--dr-felipe-cepeda@0.0.0 build
> vite build

<<<<<<< HEAD
[36mvite v6.4.1 [32mbuilding for production...[36m[39m
transforming...
[32m✓[39m 2127 modules transformed.
rendering chunks...
computing gzip size...
[2mdist/[22m[32mindex.html                              [39m[1m[2m  0.88 kB[22m[1m[22m[2m │ gzip:   0.42 kB[22m
[2mdist/[22m[35massets/index-8-zob1ez.css               [39m[1m[2m128.30 kB[22m[1m[22m[2m │ gzip:  19.25 kB[22m
[2mdist/[22m[36massets/Button-DV6LLNos.js               [39m[1m[2m  1.73 kB[22m[1m[22m[2m │ gzip:   0.92 kB[22m
[2mdist/[22m[36massets/examOrderCatalog-TXdJpgBn.js     [39m[1m[2m  4.14 kB[22m[1m[22m[2m │ gzip:   1.47 kB[22m
[2mdist/[22m[36massets/vendor-uS-d4TUT.js               [39m[1m[2m 11.92 kB[22m[1m[22m[2m │ gzip:   4.25 kB[22m
[2mdist/[22m[36massets/PatientForm-DC-nLk39.js          [39m[1m[2m 22.25 kB[22m[1m[22m[2m │ gzip:   5.90 kB[22m
[2mdist/[22m[36massets/purify.es-CFh60W_8.js            [39m[1m[2m 22.77 kB[22m[1m[22m[2m │ gzip:   8.79 kB[22m
[2mdist/[22m[36massets/browser-Bdxs9EOp.js              [39m[1m[2m 25.39 kB[22m[1m[22m[2m │ gzip:   9.97 kB[22m
[2mdist/[22m[36massets/MetricCard-dTNuUOe8.js           [39m[1m[2m 57.01 kB[22m[1m[22m[2m │ gzip:  15.85 kB[22m
[2mdist/[22m[36massets/SuperAdminDashboard-CwcFdgo0.js  [39m[1m[2m 75.68 kB[22m[1m[22m[2m │ gzip:  18.79 kB[22m
[2mdist/[22m[36massets/AdminDashboard-2c5I_75z.js       [39m[1m[2m141.69 kB[22m[1m[22m[2m │ gzip:  34.92 kB[22m
[2mdist/[22m[36massets/index.es-CYuVP-GB.js             [39m[1m[2m159.51 kB[22m[1m[22m[2m │ gzip:  53.50 kB[22m
[2mdist/[22m[36massets/html2canvas.esm-QH1iLAAe.js      [39m[1m[2m202.38 kB[22m[1m[22m[2m │ gzip:  48.04 kB[22m
[2mdist/[22m[36massets/DoctorDashboard-DFcgWNqp.js      [39m[1m[2m331.22 kB[22m[1m[22m[2m │ gzip:  86.23 kB[22m
[2mdist/[22m[36massets/index-Cdib_Qc9.js                [39m[1m[2m339.54 kB[22m[1m[22m[2m │ gzip: 101.38 kB[22m
[2mdist/[22m[36massets/jspdf.es.min-DBdkcZQw.js         [39m[1m[2m390.53 kB[22m[1m[22m[2m │ gzip: 128.65 kB[22m
[2mdist/[22m[36massets/firebase-BcxoqvZe.js             [39m[1m[2m543.02 kB[22m[1m[22m[2m │ gzip: 127.52 kB[22m
[2mdist/[22m[36massets/ui-CxLHQm8g.js                   [39m[1m[33m872.18 kB[39m[22m[2m │ gzip: 161.70 kB[22m
[32m✓ built in 17.39s[39m
=======
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
✓ built in 9.17s
>>>>>>> pr-104
```

### ❌ npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line

```text
<<<<<<< HEAD
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: 🔐 prevent committing .env to code: https://dotenvx.com/precommit

Running 5 tests using 1 worker

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🔐 prevent building .env in docker: https://dotenvx.com/prebuild

[1A[2K[1/5] [setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
DEBUG: Current URL before login check: http://localhost:5175/acceso-admin?agent_test=true

[1A[2K✅ Admin storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\admin.json

[1A[2K[2/5] [setup] › tests\auth\auth.setup.ts:103:1 › Doctor: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:103:1 › Doctor: generar sesión
✅ Doctor storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\doctor.json

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: ⚙️  write to custom object with { processEnv: myObject }

[1A[2K[3/5] [admin-tests] › tests\admin\superadmin-audit.spec.ts:16:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-01: Acceso al dashboard SuperAdmin
[1A[2K  1) [admin-tests] › tests\admin\superadmin-audit.spec.ts:16:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-01: Acceso al dashboard SuperAdmin 

    Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

    Locator: getByRole('heading', { name: /Centros Activos/i })
    Expected: visible
    Timeout: 15000ms
    Error: element(s) not found

    Call log:
    [2m  - Expect "toBeVisible" with timeout 15000ms[22m
    [2m  - waiting for getByRole('heading', { name: /Centros Activos/i })[22m


      19 |     // Debe ser visible el dashboard de superadmin
      20 |     // Usamos un heading que sepamos que está en la pestaña inicial
    > 21 |     await expect(page.getByRole("heading", { name: /Centros Activos/i })).toBeVisible({
         |                                                                           ^
      22 |       timeout: 15000,
      23 |     });
      24 |     await expect(page.getByText("Visión General", { exact: false }).first()).toBeVisible();
        at C:\Users\fecep\clave-salud\tests\admin\superadmin-audit.spec.ts:21:75

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\superadmin-audit-SuperAdmi-2e9f9-eso-al-dashboard-SuperAdmin-admin-tests\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\superadmin-audit-SuperAdmi-2e9f9-eso-al-dashboard-SuperAdmin-admin-tests\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\superadmin-audit-SuperAdmi-2e9f9-eso-al-dashboard-SuperAdmin-admin-tests\error-context.md


[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: ⚙️  enable debug logging with { debug: true }

[1A[2K[4/5] [admin-tests] › tests\admin\superadmin-audit.spec.ts:28:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-02: SuperAdmin puede alternar entre centros en Preview
[1A[2K  2) [admin-tests] › tests\admin\superadmin-audit.spec.ts:28:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-02: SuperAdmin puede alternar entre centros en Preview 

    Error: [2mexpect([22m[31mlocator[39m[2m).[22mtoBeVisible[2m([22m[2m)[22m failed

    Locator: locator('[data-testid="superadmin-dashboard-root"]')
    Expected: visible
    Timeout: 10000ms
    Error: element(s) not found

    Call log:
    [2m  - Expect "toBeVisible" with timeout 10000ms[22m
    [2m  - waiting for locator('[data-testid="superadmin-dashboard-root"]')[22m


      28 |   test("E2E-SA-02: SuperAdmin puede alternar entre centros en Preview", async ({ page }) => {
      29 |     await page.goto(`${TEST.BASE_URL}/superadmin?agent_test=true&demo_role=superadmin`);
    > 30 |     await expect(page.locator('[data-testid="superadmin-dashboard-root"]')).toBeVisible();
         |                                                                             ^
      31 |
      32 |     // 1. Usar el selector de centro para preview
      33 |     // En SuperAdminDashboard.tsx los selects están en la pestaña General (por defecto)
        at C:\Users\fecep\clave-salud\tests\admin\superadmin-audit.spec.ts:30:77

    attachment #1: screenshot (image/png) ──────────────────────────────────────────────────────────
    test-results\superadmin-audit-SuperAdmi-c853e-ar-entre-centros-en-Preview-admin-tests\test-failed-1.png
    ────────────────────────────────────────────────────────────────────────────────────────────────

    attachment #2: video (video/webm) ──────────────────────────────────────────────────────────────
    test-results\superadmin-audit-SuperAdmi-c853e-ar-entre-centros-en-Preview-admin-tests\video.webm
    ────────────────────────────────────────────────────────────────────────────────────────────────

    Error Context: test-results\superadmin-audit-SuperAdmi-c853e-ar-entre-centros-en-Preview-admin-tests\error-context.md


[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🛠️  run anywhere with `dotenvx run -- yourcommand`

[1A[2K[5/5] [admin-tests] › tests\admin\superadmin-audit.spec.ts:59:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-03: Visibilidad del Log de Auditoría Global (Opcional)
[1A[2K  2 failed
    [admin-tests] › tests\admin\superadmin-audit.spec.ts:16:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-01: Acceso al dashboard SuperAdmin 
    [admin-tests] › tests\admin\superadmin-audit.spec.ts:28:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-02: SuperAdmin puede alternar entre centros en Preview 
  3 passed (1.1m)
```

**Error/Stderr:**

```text
Command failed: npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_superadmin.md`
- **Timestamp:** `2026-03-22T13:24:09.845Z`
=======
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
  - Comando: `npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line`
  - Motivo: Comando falló durante la auditoría.
  - Recomendación: Instalar navegadores y re-ejecutar E2E: `npx playwright install`.

## Hallazgos manuales posteriores

> Completar con revisión funcional/seguridad específica del área.

- [ ] M-001
- [ ] M-002
- [ ] M-003

## Metadata de archivo

- **Ruta del reporte:** `docs/audits/2026/2026-03-22_superadmin.md`
- **Timestamp generado:** `2026-03-22T21:38:09.337Z`

>>>>>>> pr-104
