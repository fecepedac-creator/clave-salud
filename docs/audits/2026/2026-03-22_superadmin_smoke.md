# Auditoría automática — SuperAdmin Dashboard

- **Área:** `superadmin`
- **Fecha ejecución:** `2026-03-22`
- **Generado por:** `scripts/audit/run-audit.cjs`
- **Estado general:** **SIN BLOQUEOS**

## Resumen de resultados

- ✅ Pass: **1**
- ❌ Fail: **0**
- ⚠️ Warning: **0**

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
| ✅ PASS | `npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line` | 2026-03-22T21:09:12.096Z | 2026-03-22T21:09:34.681Z |

## Detalle de salida

### ✅ npx playwright test tests/admin/superadmin-audit.spec.ts --reporter=line

```text
[dotenv@17.3.1] injecting env (17) from .env.test -- tip: ⚙️  write to custom object with { processEnv: myObject }

Running 5 tests using 1 worker

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🤖 agentic secret storage: https://dotenvx.com/as2

[1A[2K[1/5] [setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:61:1 › Admin: generar sesión
DEBUG: [Auth Setup Admin] URL inicial: http://localhost:5175/acceso-admin?agent_test=true

[1A[2KDEBUG: Ya estamos en el Dashboard (Bypass activado)

[1A[2KDEBUG: Esperando Dashboard (Admin)...

[1A[2K✅ Admin storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\admin.json

[1A[2K[2/5] [setup] › tests\auth\auth.setup.ts:111:1 › Doctor: generar sesión
[1A[2K[setup] › tests\auth\auth.setup.ts:111:1 › Doctor: generar sesión
DEBUG: [Auth Setup Doctor] URL inicial: http://localhost:5175/accesoprofesionales?agent_test=true

[1A[2KDEBUG: Ya estamos en el Dashboard de Doctor (Bypass activado)

[1A[2KDEBUG: Esperando Dashboard (Doctor)...

[1A[2K✅ Doctor storageState guardado en C:\Users\fecep\clave-salud\tests\auth\.auth\doctor.json

[1A[2K[dotenv@17.3.1] injecting env (0) from .env.test -- tip: 🛡️ auth for agents: https://vestauth.com

[1A[2K[3/5] [admin-tests] › tests\admin\superadmin-audit.spec.ts:25:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-01: Acceso al dashboard SuperAdmin
[1A[2K[admin-tests] › tests\admin\superadmin-audit.spec.ts:25:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-01: Acceso al dashboard SuperAdmin
[BROWSER] log: %c Console Ninja extension is connected to Vite, background: rgb(30,30,30); color: rgb(255,213,92) see https://tinyurl.com/2vt8jxzw for more info.

[1A[2K[BROWSER] debug: [vite] connecting...

[1A[2K[BROWSER] debug: [vite] connected.

[1A[2K[BROWSER] info: %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[4/5] [admin-tests] › tests\admin\superadmin-audit.spec.ts:39:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-02: SuperAdmin puede alternar entre centros en Preview
[1A[2K[admin-tests] › tests\admin\superadmin-audit.spec.ts:39:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-02: SuperAdmin puede alternar entre centros en Preview
[BROWSER] log: %c Console Ninja extension is connected to Vite, background: rgb(30,30,30); color: rgb(255,213,92) see https://tinyurl.com/2vt8jxzw for more info.

[1A[2K[BROWSER] debug: [vite] connecting...

[1A[2K[BROWSER] debug: [vite] connected.

[1A[2K[BROWSER] info: %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] warning: [2026-03-22T21:09:31.617Z]  @firebase/firestore: Firestore (12.10.0): WebChannelConnection RPC 'Listen' stream 0x68dd423a transport errored. Name: undefined Message: undefined

[1A[2K[BROWSER] error: [2026-03-22T21:09:31.620Z]  @firebase/firestore: Firestore (12.10.0): Could not reach Cloud Firestore backend. Connection failed 1 times. Most recent error: FirebaseError: [code=unavailable]: The operation could not be completed
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.

[1A[2K[BROWSER] log: %c Console Ninja extension is connected to Vite, background: rgb(30,30,30); color: rgb(255,213,92) see https://tinyurl.com/2vt8jxzw for more info.

[1A[2K[BROWSER] debug: [vite] connecting...

[1A[2K[BROWSER] debug: [vite] connected.

[1A[2K[BROWSER] info: %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[5/5] [admin-tests] › tests\admin\superadmin-audit.spec.ts:70:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-03: Visibilidad del Log de Auditoría Global (Opcional)
[1A[2K[admin-tests] › tests\admin\superadmin-audit.spec.ts:70:3 › SuperAdmin Access & Multi-tenant Visibility › E2E-SA-03: Visibilidad del Log de Auditoría Global (Opcional)
[BROWSER] log: %c Console Ninja extension is connected to Vite, background: rgb(30,30,30); color: rgb(255,213,92) see https://tinyurl.com/2vt8jxzw for more info.

[1A[2K[BROWSER] debug: [vite] connecting...

[1A[2K[BROWSER] debug: [vite] connected.

[1A[2K[BROWSER] info: %cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [DEBUG] effectiveIsSuperAdmin: true {demoMode: true, demoRole: superadmin, isSuperAdminClaim: false}

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] log: [Audit] Iniciando Center ID de prueba: c_eji2qv61

[1A[2K[BROWSER] log: [Audit] Inyectando Centro de Test al catálogo local

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K[BROWSER] error: Encountered two children with the same key, `%s`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version. c_eji2qv61

[1A[2K  5 passed (18.2s)
```

## Hallazgos manuales (Post-Auditoría)

- [ ] H-001 (Pendiente)
- [ ] H-002 (Pendiente)

- **Reporte:** `docs\audits\2026\2026-03-22_superadmin_smoke.md`
- **Timestamp:** `2026-03-22T21:09:34.682Z`