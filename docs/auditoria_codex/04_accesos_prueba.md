# 04 — Accesos y Credenciales: ClaveSalud

## URLs de Prueba
-   **Local:** `http://localhost:5175`
-   **Production:** `https://clavesalud-2.web.app` (confirmar con el proveedor de Hosting).
-   **Staging:** No se encontró un entorno de staging específico en el repo (se asocia a la instancia principal).

## ID de Centro Recomendado
-   **Centro de Pruebas:** `c_eji2qv61` (Los Andes) — Este ID es el predeterminado para el Seed y tests de Playwright.

## Usuarios por Rol
Las credenciales reales **no se deben modificar** y se encuentran en el archivo:
-   `c:\Users\fecep\clave-salud\.env.test`

| Rol                | Email Recomendado (según env.test) | Finalidad                             |
|-------------------|-----------------------------------|---------------------------------------|
| `super_admin`     | `fecepedac@gmail.com`             | Gestión global y creación de centros. |
| `admin_centro`    | `admin.test@clavesalud.cl`        | Operación diaria del centro.          |
| `doctor`          | `doctor.test@clavesalud.cl`       | Especialidad: Medicina / General.     |
| `administrativo`  | `admin.test@clavesalud.cl`        | Gestión de agenda (usa mismo que admin).|

## Cómo obtener credenciales locales
Si no tienes acceso al archivo `.env.test`, revisa `tests/fixtures/test-data.ts` para los valores por defecto (en caso de que no haya variables de entorno).

**Ubicación de StorageState (Sesiones Persistentes):**
Playwright almacena sesiones válidas (tras correr `npx playwright test --project=setup`) en:
-   `c:\Users\fecep\clave-salud\tests\auth\.auth\admin.json`
-   `c:\Users\fecep\clave-salud\tests\auth\.auth\doctor.json`

## Notas de Seguridad
-   No compartas el contenido de `clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json` (Service Account), ya que otorga acceso total administrativo a Firebase.
-   El flag `?agent_test=true` permite by-pass de algunos flujos de login visual pero requiere que el usuario ya tenga una cuenta registrada en Firebase Auth.
