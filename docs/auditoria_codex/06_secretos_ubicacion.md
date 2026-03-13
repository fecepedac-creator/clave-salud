# 06 — Secretos y Archivos Sensibles: ClaveSalud

A continuación, la lista de archivos que contienen llaves API, credenciales administrativas o configuraciones de seguridad. **No los modifiques sin autorización explícita.**

## 1. Google/Firebase Service Account
-   **Nombre:** `clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json`
-   **Ruta:** `c:\Users\fecep\clave-salud\clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json`
-   **Contenido:** Credenciales maestras (Private Key) de Google Cloud para el Proyecto `clavesalud-2`. Permite saltarse todas las reglas de Firestore (Rules) usando el Admin SDK.
-   **Vigencia:** Vigente (necesario para scripts de auditoría y seeds).

## 2. Variables de Entorno Locales
-   **Nombre:** `.env.local`
-   **Ruta:** `c:\Users\fecep\clave-salud\.env.local`
-   **Contenido:** API Keys de Firebase para desarrollo.
-   **Vigencia:** Vigente.

## 3. Variables de Entorno de Testing
-   **Nombre:** `.env.test`
-   **Ruta:** `c:\Users\fecep\clave-salud\.env.test`
-   **Contenido:** IDs de centros de prueba y credenciales en texto plano para que Playwright pueda iniciar sesión (`ADMIN_EMAIL`, `ADMIN_PASSWORD`, etc.).
-   **Vigencia:** Vigente (usado por Playwright).

## 4. Sesiones Persistentes (Cookies/Storage)
-   **Ruta:** `c:\Users\fecep\clave-salud\tests\auth\.auth/`
-   **Contenido:** Archivos JSON con tokens de sesión válidos.
-   **Vigencia:** Temporal (vencen según políticas de Firebase Auth, usualmente 1 hora de ID Token, pero el Refresh Token dura más).

## 5. Metadata Sensible
-   **Nombre:** `metadata.json`
-   **Ruta:** `c:\Users\fecep\clave-salud\metadata.json`
-   **Contenido:** Información interna del proyecto (versión, fecha de creación).
-   **Vigencia:** Informativo.

---
**NOTA:** El archivo `.env.production` también existe en la raíz, pero el despliegue suele hacerse mediante el CLI de Firebase, que inyecta estas variables durante el build.
