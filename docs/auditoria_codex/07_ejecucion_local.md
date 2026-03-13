# 07 — Pasos de Ejecución Local: ClaveSalud

Siga estos pasos exactos para levantar el entorno y auditar la plataforma:

## 1. Levantar la Aplicación
Instalar dependencias y correr en modo desarrollo:
```bash
# Directorio raíz: c:\Users\fecep\clave-salud
npm install
npm run dev
```
La aplicación estará disponible en: [http://localhost:5175](http://localhost:5175).

## 2. Preparar Datos de Prueba (Seed)
Para que los KPIs y dashboards Admin/Doctor tengan datos, debes poblar Firestore:
```bash
# Requiere ts-node instalado
npx ts-node --esm tests/fixtures/force_seed.ts
```
*Este script usa `clavesalud-2-firebase-adminsdk-fbsvc-e55040e97b.json` para conectarse.*

## 3. Correr la Suite Playwright
Asegúrese de que el puerto en `.env.test` coincide con el del `dev server` (actualmente `5175`).

**Correr todos los tests en la consola:**
```bash
npx playwright test
```

**Generar/Actualizar la autenticación (SÓLO SETUP):**
```bash
npx playwright test --project=setup
```

**Abrir modo UI (Recomendado para auditoría visual):**
```bash
npx playwright test --ui
```

## 4. Auditoría de Seguridad (Multi-tenant)
Para verificar que los datos están bien aislados por centro:
```bash
# Directorio raíz: c:\Users\fecep\clave-salud
node scripts/audit_isolation_fixed.cjs
```
Este script imprimirá en la terminal si hay "registros huérfanos" (que no pertenezcan a ningún centro específico).

## 5. Ver el Reporte de Auditoría de Mercado
Existe un reporte previo en la raíz:
- `c:\Users\fecep\clave-salud\MARKET_READINESS_REPORT.md`
Consúltelo para entender el estado de preparación para lanzamiento hasta el 8 de Marzo.

## Uso de Emuladores (Opcional)
Actualmente el proyecto no está configurado para emuladores locales en `firebase.ts`. Si desea activarlos, deberá modificar la conexión para usar `connectFirestoreEmulator(db, 'localhost', 8080)`. **No se recomienda** para esta auditoría ya que los datos determinísticos están en la instancia real de Firebase.
