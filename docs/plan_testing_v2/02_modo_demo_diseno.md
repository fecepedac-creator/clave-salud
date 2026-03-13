# Modo Demo / Test UI: ClaveSalud V2

El Modo Demo se ha diseñado e implementado como un **Bypass de Usuario Local** dentro de `App.tsx` para permitir que el frontend cargue datos estáticos y lógica de negocio visual sin necesidad de Auth real.

## Activación del Modo Demo
Se activa mediante parámetros de URL (`window.location.search`):

- **demo=true**: Activa el estado `demoMode` en `App.tsx`.
- **demo_role=[admin|doctor|superadmin]**: Define el perfil de usuario mock (UID, roles, centros). Defaults to `admin`.

## Comportamiento Técnico
Cuando se activa `demoMode`, `App.tsx` **ignora** el estado de `useAuth()` (Firebase authState) y en su lugar inyecta:
- `effectiveAuthUser`: Objeto mock `{ uid: "demo_user_uid", email: "demo@clavesalud.com" }`.
- `effectiveLocalCurrentUser`: Perfil mock con roles que coinciden con `demo_role`.
- `effectiveIsSuperAdmin`: Forzado a `true` si `demo_role=superadmin`.

## Sincronización de Datos (Mock Data)
- **useCenters(demoMode)**: Carga la lista `INITIAL_CENTERS` desde `constants.ts` en lugar de listar la colección `/centers` de Firestore.
- **useFirestoreSync(demoMode)**: Carga `MOCK_PATIENTS`, `INITIAL_DOCTORS` y otros activos estáticos, bloqueando las escrituras reales en el backend.

## Ventajas para Auditories
Permite entrar a cualquier dashboard de forma instantánea:
- `http://localhost:5175/center/c_saludmass?demo=true&demo_role=admin`
- `http://localhost:5175/pro/center/c_saludmass?demo=true&demo_role=doctor`
- `http://localhost:5175/superadmin?demo=true&demo_role=superadmin`
