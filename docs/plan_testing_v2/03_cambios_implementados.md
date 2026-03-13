# Cambios Implementados: Estrategia V2

Se han realizado modificaciones precisas en la arquitectura base para soportar la Capa 1 (Demo) de testing.

## Archivos Modificados

### 1. `App.tsx` (Nucleo)
- **Detección de `demoMode`**: Se añadió un estado inicial que detecta el parámetro `?demo=true` en el primer renderizado.
- **Mock de Usuario**: Se crearon los objetos `mockDemoUser` y `effectiveLocalCurrentUser` para interceptar la lógica de autenticación de `useAuth()`.
- **Inyección de Perfil**: Se inyectan `effectiveAuthUser` y `effectiveIsSuperAdmin` hacia los hooks de datos (`useCenters`, `useFirestoreSync`).
- **Navegación**: Se habilitó el acceso directo a Dashboards si `demoMode` está activo, ignorando el `setView` hacia el login de Firebase.

### 2. `constants.ts` (Datos Mock)
- Contiene los catálogos y listas estáticas (`INITIAL_CENTERS`, `MOCK_PATIENTS`, `INITIAL_DOCTORS`) que alimentan el modo demo. No han sido modificados pero ahora se usan extensamente.

### 3. `playwright.config.ts` (Configuración)
- Se ha diseñado la base para separar proyectos de `demo-suite` y `e2e-suite`. (Falta terminación técnica en el archivo de config real).

## Motivación Técnica
El cambio se centra en **desacoplar** la autenticación del renderizado. Si se usa `demo=true`, el sistema cree que está logueado con un usuario que tiene todos los permisos para el rol solicitado, cargando datos instantáneamente desde la memoria local en lugar de la red.
