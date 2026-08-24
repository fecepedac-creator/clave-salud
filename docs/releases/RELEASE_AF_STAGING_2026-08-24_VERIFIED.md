# Verificación de staging A-F — 2026-08-24

## Candidato

- Rama: `codex/release-integration-af`
- Commit desplegado en Hosting: `83e226d`
- Proyecto aislado: `clavesalud-staging-20260824`
- URL: `https://clavesalud-staging-20260824.web.app`
- Producción: `clavesalud-2` no fue modificada.

## Trenes cubiertos

| Tren | Alcance comprobado |
| --- | --- |
| A | Dashboards visuales de profesional, administración y SuperAdmin. |
| B | Reserva administrativa transaccional y continuidad de agenda. |
| C | Borrador, firma, inmutabilidad y adenda clínica. |
| D | Perfiles, capacidades y recursos de agenda. |
| E | Reglas de privacidad, auditoría y soporte acotado. |
| F | Portal protegido, documentos/consentimientos publicados y calendario deshabilitado por defecto. |

## Evidencia ejecutada

- Política de staging: `npm run test:release-policy` — 20/20.
- Build web: `npm run build` — correcto.
- Smoke de navegador aislado: `npm run test:e2e:release-smoke` — 19/19.
- Reglas Firestore: `npm run test:rules` — 24/24; reglas compiladas y desplegadas al proyecto staging.
- Gate clínico autenticado con emuladores: `npm run test:e2e:emulator-gate` — correcto.
- Concurrencia de reservas: `administrative-booking.integration.test.ts` — 9/9.
- Functions en staging activas: agenda administrativa, borrador/firma/adenda, portal publicado, soporte acotado, directorio de pacientes y operaciones de centro.
- Google Sign-In habilitado exclusivamente en staging. El acceso directo a `/superadmin` queda en la pantalla de ingreso si no existe un claim válido.

## Reversión

- Canal de Hosting disponible: `rollback-baseline`.
- Base de reversión de código: `5518680c770c6b18924dfe95b057535387c977d5`.
- No se borran ni migran datos para revertir; las colecciones nuevas son aditivas.

## Límites antes de producción

- No promover todos los trenes en un solo salto: usar commits reversibles por tren y observación posterior.
- La prueba de consentimiento interactivo de una cuenta Google real debe hacerse en el navegador del operador; el proveedor ya está habilitado y el resto de los flujos se validó con cuentas sintéticas y emuladores.
- Calendar, mensajería y otras integraciones de efecto externo continúan deshabilitadas por defecto.
