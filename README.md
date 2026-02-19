<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1izK1pyrhMep1211AhQVY8JSC57cFM9eh

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Marketing RRSS (Afiche) módulo

El módulo de afiches RRSS usa una función Cloud Functions (`generateMarketingPoster`) que genera
una plantilla SVG sobria (sin claims médicos) y, opcionalmente, la guarda en Storage por 7 días.

Configuración por centro (SuperAdmin):
- `centers/{centerId}/settings/marketing`
  - `enabled`: habilita el módulo
  - `monthlyPosterLimit`: límite mensual (usa `-1` para ilimitado)
  - `allowPosterRetention`: permite al admin guardar afiches por 7 días
  - `posterRetentionDays`: fijo en `7`

Despliegue:
- `firebase deploy --only functions,firestore:rules,storage`

## Capa de emails transaccionales (Cloud Functions)

Se agregó una capa backend reutilizable para envíos transaccionales desde `functions/src/email.ts`.

- API interna: `sendEmail(to, subject, html/text, tags, centerId, relatedEntityId)`.
- Proveedor actual: **SendGrid** vía HTTP API.
- Logs automáticos en Firestore:
  - `centers/{centerId}/messageLogs/{id}`
  - campos: `type`, `channel="email"`, `to`, `templateId`, `relatedType`, `relatedId`, `status`, `error`, `createdAt`.

### Variables de entorno / secretos requeridos

> Solo nombres (no valores):

- `EMAIL_PROVIDER_API_KEY`
- `EMAIL_FROM`

### Prueba local rápida

1. Build de functions:
   - `cd functions && npm run build`
2. Levantar emuladores (si aplica):
   - `firebase emulators:start --only functions,firestore`
3. Invocar callable de smoke test `sendTestTransactionalEmail` (desde Admin SDK, shell o frontend autenticado con rol habilitado) enviando:
   - `centerId`
   - `to`
   - opcional: `subject`, `text`, `relatedEntityId`
4. Verificar en Firestore:
   - `centers/{centerId}/messageLogs`
   - éxito: `status = "sent"`
   - error forzado (correo inválido): `status = "failed"` y `error` con detalle del proveedor.
