# 03 — Estado de Playwright: ClaveSalud

## Configuración de Playwright
-   **Configuración:** `playwright.config.ts`.
-   **Entorno:** Usa `.env.test` para variables de entorno dedicadas.
-   **Servidor:** Auto-inicia `npm run dev` en el puerto `5175` (configuración ajustada recientemente).
-   **Estrategia:** Ejecución secuencial (`workers: 1`) para evitar colisiones en Firestore durante transacciones de reserva.

## Tests Existentes
| Proyecto           | Directorio               | Tests Críticos                                  |
|-------------------|--------------------------|------------------------------------------------|
| `setup`           | `tests/auth/auth.setup.ts`| Generación de `admin.json` y `doctor.json`.     |
| `admin-tests`     | `tests/admin/`           | Login, KPIs, Cierre de Mes, Multi-tenant.      |
| `doctor-tests`    | `tests/doctor/`          | Login, KPIs Doctor, Flujo PSCV Completo.        |

## Flujos Cubiertos
-   **Autenticación:** Generación y persistencia de sesión por roles (`storageState`).
-   **Ficha Clínica (PSCV):** Creación de paciente -> Registro de signos vitales -> Finalizar consulta -> Verificar en historial.
-   **Seguridad:** Validación de aislamiento (Multi-tenant) entre centros distintos.
-   **Cierre Contable:** Flujo completo de KPIs y badge de cierre mensual.

## Flujos NO Cubiertos (Opend)
-   **Pagos Reales:** Integración con pasarelas de pago (solo simulado en la lógica).
-   **Firma Electrónica:** No hay integración con proveedores de firma avanzada (e-sign).
-   **Mensajería WhatsApp:** Solo se valida el envío simbólico (mailto/manual text).
-   **Carga de Archivos:** Pruebas de subida masiva a Firebase Storage.

## Características de la Suite
-   **IndexedDB Bridge:** Implementado en `auth.setup.ts` para capturar la sesión de Firebase (que está en IndexedDB) y pasarla a `localStorage`, permitiendo que Playwright la persista.
-   **Seed Script:** Usa `tests/fixtures/force_seed.ts` para poblar Firestore con datos determinísticos antes de las pruebas.
-   **Agent Test:** Usa el flag `?agent_test=true` en las URLs para activar el modo de "Ingreso Rápido" y evitar prompts adicionales.

## Puntos Frágiles
-   **Dependencia de Datos Reales:** Los tests asertan sobre valores específicos del Seed (ej: "10 citas"). Si el seed cambia, los tests fallan.
-   **Latencia de Firestore:** Como se aserta sobre sincronización en tiempo real (`onSnapshot`), pueden ocurrir race conditions si el WiFi/Firestore está lento (usar timeouts generosos).
-   **IndexedDB Sync:** La captura de sesión depende del bridge en `auth.setup.ts`. Si Firebase cambia el nombre de la DB (`firebaseLocalStorageDb`), el bridge fallará.
