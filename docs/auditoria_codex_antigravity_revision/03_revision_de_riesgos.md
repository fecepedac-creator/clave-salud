# 03 — Revisión de Riesgos: Antigravity

He aquí un desglose categorizado de mis propios cambios realizados en el repositorio, con recomendaciones claras sobre qué conservar y qué revertir.

## 1. Seguros para Conservar
*   **`.env.test`**: Se recomienda conservar el cambio del puerto `5176` a `5175`. Este cambio es el único que permite la comunicación real de Playwright con el servidor de desarrollo VITE local.
*   **`docs/auditoria_codex/` (CARPETA)**: Al ser puramente informativo, **no presenta ningún riesgo** para la aplicación ni para los tests. Es un valioso banco de conocimiento.

## 2. Dudosos / No Comprobados
*   **`tests/doctor/pscv-flow.spec.ts`**: Es un test muy robusto que simula un flujo completo del negocio clínico. Sin embargo, al depender de una sesión de usuario válida (`storageState`), su ejecución no ha sido verificada con éxito todavía. **Se recomienda AISLARLO** o moverlo a una carpeta de "Propuestas" hasta que la sesión funcione.
*   **`tests/admin/full-audit.spec.ts`**: Al igual que el anterior, contiene aserciones de mercado importantes, pero sus aserciones de UI (`data-testid`) podrían estar desactualizadas si no se verifica contra la UI real.

## 3. Deberían Revertirse o Refactorizarse
*   **`tests/auth/auth.setup.ts`**: El código inyectado (`bridgeFirebaseSession`) **debe ser revertido** o reemplazado.
    *   **Motivo**: Genera archivos JSON de sesión vacíos, lo cual es inútil y confuso para otros agentes.
    *   **Reemplazo**: Se sugiere pasar a un modelo de "Sesión Manual" donde se inyecte el token de usuario directamente en `localStorage` usando el `idToken` de Firebase Auth vía API (`fetch`), saltándose el bridge de IndexedDB del navegador.

## 4. Riesgo de Producto
Se reitera que **NO se ha modificado ningún archivo de la aplicación principal** (`/src` o carpetas de componentes / hooks de producción). No hay riesgo de regresión en la lógica de negocio para los usuarios finales debido a mi intervención.
