# 02 — Configuración de Firebase: ClaveSalud

## Archivos de Conexión
-   **`firebase.ts` (RAÍZ):** Inicializa el cliente Firebase (App, Firestore, Auth, Storage, Functions).
-   **`firestore.rules` (RAÍZ):** Define el esquema de seguridad y acceso a los datos (Multi-tenant).
-   **`storage.rules` (RAÍZ):** Seguridad para logos de centros, fotos de profesionales y adjuntos.
-   **`firebase.json` (RAÍZ):** Configuración para despliegue en Hosting e índices de Firestore.

## Detalles del Proyecto
-   **ID del Proyecto:** `clavesalud-2`
-   **Dominio de Auth:** `clavesalud-2.firebaseapp.com`
-   **Región de Cloud Functions:** `us-central1`

## Servicios Utilizados
-   **Firestore:** Base de datos principal NoSQL estructurada en `/centers`, `/patients` y `/users`.
-   **Authentication:** Email/Password y Google Sign-In.
-   **Storage:** Almacenamiento de activos (logos, adjuntos clínicos).
-   **Hosting:** Despliegue de la aplicación web.
-   **Cloud Functions:** Lógica server-side (en `/functions`) para tareas pesadas y seguridad avanzada.

## Variables de Entorno Requeridas
Las variables están en `.env.local` (desarrollo) y `.env.production` (producción). Deben seguir este esquema:
-   `VITE_FIREBASE_API_KEY`
-   `VITE_FIREBASE_AUTH_DOMAIN`
-   `VITE_FIREBASE_PROJECT_ID`
-   `VITE_FIREBASE_STORAGE_BUCKET`
-   `VITE_FIREBASE_MESSAGING_SENDER_ID`
-   `VITE_FIREBASE_APP_ID`

**Ubicación de archivos `.env`:**
-   `c:\Users\fecep\clave-salud\.env.local`
-   `c:\Users\fecep\clave-salud\.env.test`
-   `c:\Users\fecep\clave-salud\.env.production`

## Estado de Emuladores
El proyecto **no** parece utilizar emuladores locales de Firebase activamente por defecto. Se conecta directamente a la instancia `clavesalud-2`.

## Recomendaciones para Auditoría
-   Revisar `firestore.rules` línea ~458 para validar el aislamiento por `centerId` en el módulo de pacientes.
-   Validar que las Cloud Functions manejen correctamente los privilegios elevados (Admin SDK).
-   El repositorio apunta a la instancia de **Producción/Test Real** (`clavesalud-2`). No hay señales de una instancia de desarrollo aislada en backend, por lo que toda prueba debe hacerse con precaución.
