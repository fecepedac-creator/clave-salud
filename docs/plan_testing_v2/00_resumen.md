# Estrategia de Testing V2: ClaveSalud

Esta nueva estrategia divide las pruebas en dos capas complementarias para maximizar la velocidad de desarrollo y la estabilidad del producto.

## 1. Capa Demo / UI Testing (Sin Login)
- **Objetivo**: Validar la interfaz, navegación, responsividad y flujos visuales.
- **Mecanismo**: Uso del flag `?demo=true` en la URL.
- **Datos**: Mockeados estéticamente en `constants.ts`.
- **Ventaja**: No depende de Firebase Auth, latencia de red ni estados de IndexedDB. Es instantánea y determinística.

## 2. Capa E2E Real (Con Login)
- **Objetivo**: Validar la seguridad, reglas de Firestore, Cloud Functions y persistencia real.
- **Mecanismo**: Flujo de autenticación real con roles específicos.
- **Datos**: Base de datos real `clavesalud-2` (o emuladores).
- **Ventaja**: Asegura que el sistema es seguro y que la integración con el backend es correcta.

## Resumen Técnico
Se ha implementado una interceptación en `App.tsx` que, al detectar el parámetro `demo=true`, inyecta un perfil de usuario ficticio y activa el `demoMode` en todos los hooks de datos (`useCenters`, `useFirestoreSync`). Esto permite navegar por los dashboards de Admin, Doctor y SuperAdmin sin necesidad de credenciales reales.
