# 05 — Documentación Útil: Antigravity

He creado una serie de documentos para facilitar la auditoría técnica profunda. A continuación, indico cuáles son fidedignos y cuáles deben leerse con cautela.

## 1. Archivos Confiables ✅
Estos documentos son resúmenes precisos basados en la lectura del código fuente del proyecto (`App.tsx`, `useAuth.ts`, `firestore.rules`, etc.) y representan fielmente la arquitectura del sistema:

-   **`docs/auditoria_codex/00_resumen_general.md`**: Contexto del negocio y módulos operativos.
-   **`docs/auditoria_codex/01_rutas_y_dashboards.md`**: Guía precisa de URLs y flujos de usuario (Admin, Doctor, SuperAdmin).
-   **`docs/auditoria_codex/02_firebase_config.md`**: Detalle del backend de Firebase (`clavesalud-2`) y variables de entorno.
-   **`docs/auditoria_codex/05_archivos_clave.md`**: Índice de los archivos más importantes para entender el código fuente.
-   **`docs/auditoria_codex/06_secretos_ubicacion.md`**: Lista exacta de archivos `.env` y llaves API.

## 2. Archivos para Leer con Cautela ⚠️
Estos archivos documentan la suite de tests, la cual contiene errores conocidos de estabilidad y persistencia que he detectado en esta revisión:

-   **`docs/auditoria_codex/03_playwright_estado_actual.md`**: Afirma que el bridge de IndexedDB es funcional. **Ignorar esta afirmación.** Las sesiones persisten vacías en la práctica.
-   **`docs/auditoria_codex/04_accesos_prueba.md`**: Indica cómo usar el `storageState`. Funciona en teoría, pero los archivos JSON actuales están vacíos.
-   **`docs/auditoria_codex/07_ejecucion_local.md`**: Los comandos (`npx playwright test`) fallarán por errores de autenticación hasta que se resuelva el problema de las sesiones.
-   **`docs/auditoria_codex/99_estado_entrega.md`**: Es un resumen del estado de entrega anterior. Debe leerse como un "Estado de Avance" y no como una conclusión final de estabilidad.

---
**RECOMENDACIÓN**: Utilizar la documentación de arquitectura para entender el sistema ClaveSalud, pero **no confiar** en la documentación de la suite de tests hasta que se estabilice el flujo de autenticación automática.
