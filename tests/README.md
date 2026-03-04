# ClaveSalud — Suite de Tests E2E con Playwright

## Estructura

```
tests/
├── auth/
│   ├── auth.setup.ts          # Genera admin.json y doctor.json (corre primero)
│   └── .auth/
│       ├── admin.json         # storageState del Admin (gitignored)
│       └── doctor.json        # storageState del Doctor (gitignored)
├── fixtures/
│   ├── test-data.ts           # Constantes: centerId, doctorId, yearMonth, SEED
│   └── helpers.ts             # Funciones reutilizables: navegación, cierre de mes
├── admin/
│   ├── login.spec.ts          # T1 — Smoke login Admin
│   ├── performance-tab.spec.ts # T2 — KPIs, T3 — Cierre de Mes
│   ├── closed-month-guard.spec.ts # T4 — Guard mes cerrado
│   ├── export-csv.spec.ts     # T5 — Export CSV Excel-compatible
│   └── multi-tenant.spec.ts   # T9 — Aislamiento entre centros
└── doctor/
    ├── login.spec.ts          # T6 — Smoke login Doctor
    └── performance-tab.spec.ts # T7 — KPIs Doctor, T8 — Multi-tenant canario
```

## Requisitos previos

1. Copiar y rellenar variables de entorno:
   ```bash
   cp .env.test.example .env.test
   # Editar .env.test con credenciales reales
   ```

2. Asegurar que el seed de Firestore está aplicado:
   ```bash
   npx ts-node --esm tests/fixtures/force_seed.ts
   ```

3. Tener el servidor de desarrollo corriendo (o dejar que Playwright lo inicie):
   ```bash
   npm run dev
   ```

## Variables de entorno requeridas (`.env.test`)

| Variable              | Descripción                              |
|-----------------------|------------------------------------------|
| `TEST_CENTER_ID`      | ID del centro de pruebas (ej: `c_eji2qv61`) |
| `TEST_DOCTOR_ID`      | UID del doctor A                         |
| `ADMIN_EMAIL`         | Email del Admin del centro               |
| `ADMIN_PASSWORD`      | Contraseña del Admin                     |
| `DOCTOR_EMAIL`        | Email del Doctor A                       |
| `DOCTOR_PASSWORD`     | Contraseña del Doctor A                  |
| `PLAYWRIGHT_BASE_URL` | (opcional) URL del servidor, default `http://localhost:5175` |

## Correr local

```bash
# Suite completa (admin + doctor):
npx playwright test --project=admin-tests --project=doctor-tests

# Solo admin:
npx playwright test --project=admin-tests

# Solo doctor:
npx playwright test --project=doctor-tests

# Un test específico:
npx playwright test tests/admin/performance-tab.spec.ts --project=admin-tests

# Con UI interactiva (recomendado para debug):
npx playwright test --ui
```

## Ver el reporte HTML

```bash
# Después de correr los tests:
npx playwright show-report

# Abre playwright-report/index.html en el navegador
```

## Ver traces (en fallos)

Los traces se generan automáticamente en el primer reintento de fallos.

```bash
# Abrir trace de un test fallido:
npx playwright show-trace test-results/<test-folder>/trace.zip
```

O desde el reporte HTML: click en el test fallido → pestaña "Trace".

## Correr en CI

```bash
# La variable CI=true activa:
# - 1 retry por fallo
# - Reporter de GitHub Actions
# - Servidor fresh (reuseExistingServer: false)
CI=true npx playwright test --project=admin-tests --project=doctor-tests
```

## Tests disponibles

| ID  | Nombre                                | Tipo              | Archivo                       |
|-----|---------------------------------------|-------------------|-------------------------------|
| T1  | Admin Login y acceso a dashboard      | Smoke             | admin/login.spec.ts           |
| T2  | KPIs Tab Rendimiento Admin            | Funcional         | admin/performance-tab.spec.ts |
| T3  | Cierre Contable + Badge               | E2E Financiero    | admin/performance-tab.spec.ts |
| T4  | Closed Month Guard                    | Seguridad         | admin/closed-month-guard.spec.ts |
| T5  | Export CSV Excel-compatible           | Reportería        | admin/export-csv.spec.ts      |
| T6  | Doctor Login y acceso a dashboard     | Smoke             | doctor/login.spec.ts          |
| T7  | Doctor Tab Rendimiento                | Funcional         | doctor/performance-tab.spec.ts |
| T8  | Multi-tenant Doctor (canario)         | Seguridad         | doctor/performance-tab.spec.ts |
| T9  | Multi-tenant Admin (otro centro)      | Seguridad         | admin/multi-tenant.spec.ts    |

## Dataset del seed

Los valores numéricos utilizados en las aserciones están definidos en `tests/fixtures/test-data.ts`:

```typescript
SEED.DOCTOR_STATS = {
  totalAppointments: 10,
  completed: 7,       // Doctor A — canario para T8
  noShow: 2,
  cancelled: 1,
  billableCount: 7,
  totalAmountBillable: 350000
}
```

Si el seed cambia, actualizar primero `test-data.ts` antes de correr los tests.

## Buenas prácticas establecidas

- **Sin `waitForTimeout`** — todas las esperas son por señales determinísticas (`toBeVisible`, `toHaveText`, etc.)
- **`data-testid`** para todos los selectores críticos
- **Animaciones desactivadas** en modo test (via `disableAnimations()` en helpers)
- **storageState** para auth — no re-login en cada test
- **Teardown** automático en T3 y T4 para dejar el estado limpio
