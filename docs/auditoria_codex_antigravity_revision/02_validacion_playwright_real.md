# 02 — Validación Playwright Real: Antigravity

A continuación, la evidencia directa del estado actual de la suite Playwright después de mi intervención.

## 1. Puerto Real Usado
- **Encontrado en `.env.test`**: `PLAYWRIGHT_BASE_URL=http://localhost:5175`
- **Encontrado en `vite.config.ts`**: `port: 5175`
- **Status**: **SÍ COINCIDEN.** El cambio en `.env.test` resolvió los errores iniciales de conexión.

## 2. Contenido de `.env.test` (Snippet)
```bash
# URL del servidor de desarrollo
PLAYWRIGHT_BASE_URL=http://localhost:5175

# ID del centro de pruebas
TEST_CENTER_ID=c_eji2qv61

# ---- Admin de Centro ----
ADMIN_EMAIL=admin.test@clavesalud.cl
ADMIN_PASSWORD=TestAdmin2026!
...
```
- **Status**: **CORRECTO.** Los usuarios de prueba y el `TEST_CENTER_ID` son coherentes con la estructura de la aplicación.

## 3. Contenido Actual de Sesiones (`storageState`)
He verificado el contenido de los archivos generados tras la ejecución de `auth.setup.ts`:

- **`tests/auth/.auth/admin.json`**:
```json
{
  "cookies": [],
  "origins": []
}
```
- **`tests/auth/.auth/doctor.json`**:
```json
{
  "cookies": [],
  "origins": []
}
```

## 4. Análisis de Resultados: IndexedDB Bridge
- **¿Es funcional el storageState?**: **NO.**
- **Conclusión**: El "bridge" inyectado en `auth.setup.ts` **ha fallado en persistir la sesión**. Aunque el código busca copiar de IndexedDB a LocalStorage, Playwright captura un estado vacío. 
- **Efecto**: Cualquier test que use estos archivos (`storageState: "..."`) fallará inmediatamente porque aparecerá como un usuario no autenticado en la aplicación.

## 5. Causa Probable
Firebase Auth puede estar tardando más tiempo en asentar la sesión en IndexedDB o bien el script `bridge` no está encontrando la base de datos correcta (`firebaseLocalStorageDb`) en el navegador de Playwright durante el setup.

---
**ESTADO**: **NO ESTABLE.** El sistema de autenticación automática para tests está roto y requiere un enfoque distinto (probablemente asentar `localStorage` manualmente con el `idToken` obtenido por API de Firebase en lugar de usar la UI).
