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
