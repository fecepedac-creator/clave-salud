# 04 — Recomendación Operativa: Antigravity Final

Basado en la inspección definitiva al cierre de la sesión de hoy (10 de Marzo), he aquí las recomendaciones estrictas de operación para el próximo agente:

## 1. Cambios que Conviene CONSERVAR Hoy ✅
*   **`.env.test`**: El puerto `5175` es el correcto y evita errores de conexión (`Connection Refused`).
*   **Audit Docs**: Toda la información de arquitectura reunida en `docs/auditoria_codex/` es precisa y valiosa para entender el sistema de roles y flujos de ClaveSalud.

## 2. Cambios que Conviene REVISAR uno por uno 🔍
*   **`tests/doctor/pscv-flow.spec.ts`**: Esencialmente correcto desde el punto de vista lógico (negocio clínico), pero depende de que la sesión sea funcional.
*   **`tests/admin/full-audit.spec.ts`**: Contiene aserciones de mercado que deberían verificarse contra la UI real.

## 3. Cambios que NO deberían usarse aún ❌
*   **`tests/auth/auth.setup.ts`**: El contenido inyectado hoy para el bridge de IndexedDB **debe ser eliminado o refactorizado**. No es estable y produce archivos de sesión vacíos.

## 4. Estado General de Playwright
*   **¿Dada la situación actual, el repo está listo para seguir con Playwright?**
*   **Respuesta**: **NO.** Hasta que no se logre una sesión inyectando el `token` directamente (por ejemplo, mediante un script de Seed que genere los archivos JSON de sesión en lugar de la UI), Playwright será una fuente constante de frustración y fallos por timeout en el login.

---
**RECOMENDACIÓN CRÍTICA**: No añadir más tests. El próximo paso de debe ser **ÚNICAMENTE estabilizar la autenticación automática**. Una vez que los archivos `.auth/admin.json` contengan un rastro de sesión válido de Firebase, el resto de la suite de tests podrá ser verificada.
