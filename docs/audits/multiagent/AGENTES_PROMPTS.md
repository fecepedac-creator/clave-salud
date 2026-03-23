# Prompts por agente (1 área = 1 agente)

## Agente 1 — Capa transversal de acceso y tenancy
Audita: `hooks/useAuth.ts`, `hooks/useCenters.ts`, `hooks/useFirestoreSync.ts`, reglas relacionadas.

Evalúa:
- Autenticación, claims y resolución de roles.
- Aislamiento multi-tenant (horizontal/vertical).
- Riesgo de fuga de datos por filtros o consultas.

---

## Agente 2 — SuperAdmin Dashboard
Audita: `components/SuperAdminDashboard.tsx`, flujos de acceso en `App.tsx`, pruebas E2E de superadmin.

Evalúa:
- Acceso con privilegios globales.
- Preview entre centros.
- Gobierno de centros/finanzas/comunicación.

---

## Agente 3 — Admin Center Dashboard
Audita: `components/AdminDashboard.tsx`, `features/admin/components/AdminPerformanceTab.tsx`, pruebas admin.

Evalúa:
- Agenda/staff/pacientes/rendimiento.
- Cierre contable, exportaciones, guardas de seguridad.
- Configuración operativa (incluye WhatsApp config de centro).

---

## Agente 4 — Doctor Dashboard (núcleo)
Audita: `components/DoctorDashboard.tsx`, pruebas doctor login/performance/PSCV.

Evalúa:
- Flujo operativo clínico principal.
- Estado y sincronización de agenda/pacientes.
- Aislamiento de métricas por profesional.

---

## Agente 5 — Subvistas por profesional
Audita: `features/doctor/components/*` (patients, agenda, record, settings, performance).

Evalúa:
- Permisos por subtab.
- Fugas de información en listados y ficha.
- Validaciones, errores y estados vacíos.

---

## Agente 6 — Canales automáticos y bots (WhatsApp / Functions)
Audita: `functions/src/whatsapp.ts`, `functions/src/index.ts`, reglas relacionadas, tests del agente.

Evalúa:
- Seguridad de webhook y secretos.
- Idempotencia y transacciones de reserva.
- Handoff y privacidad de conversación.

---

## Agente 7 — Portal paciente / booking público
Audita: flujos de reserva/cancelación/formulario y rutas públicas.

Evalúa:
- Validaciones de entrada.
- Borde de seguridad en rutas públicas.
- Riesgos de enumeración/fuga de datos por URL/estado.

---

## Instrucción común para TODOS
Entrega exclusivamente en el formato definido en `docs/audits/multiagent/SALIDA_ESTANDAR.md`.
