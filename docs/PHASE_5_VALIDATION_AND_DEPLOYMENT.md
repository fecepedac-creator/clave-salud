# Fase 5 — Validación integral y despliegue gradual

Objetivo: cerrar la implementación de Fases 1–4 con validación técnica y despliegue controlado, sin cambiar flujos clínicos/roles para usuarios válidos.

## 1) Validación técnica ejecutada en entorno de desarrollo

### 1.1 Build frontend
- Comando: `npm run build`
- Resultado: **OK**
- Evidencia: compilación Vite exitosa.

### 1.2 Build Cloud Functions
- Comando: `cd functions && npm run build`
- Resultado: **OK**
- Evidencia: compilación TypeScript exitosa.

### 1.3 Pruebas de reglas con emuladores (Firestore + Storage)
- Comando intentado: `npx -y firebase-tools --version` (prerrequisito para emuladores)
- Resultado: **No ejecutable en este entorno** por restricción del registry (`403 Forbidden` al descargar `firebase-tools`).
- Impacto: no fue posible correr localmente `firebase emulators:exec` en esta sesión.
- Acción para equipo con acceso: ejecutar pruebas de reglas en CI o máquina con `firebase-tools` habilitado.

## 2) Matriz mínima de verificación de reglas (para staging)

> Ejecutar con emuladores o staging real antes de producción.

### 2.1 Storage
- Staff activo puede leer logo de `centers-logos/{centerId}/{file}`.
- `center_admin` puede escribir logo.
- No autenticado no puede leer/escribir logo.

### 2.2 Firestore — preadmissions
- Create anónimo en `/preadmissions/{docId}`: **bloqueado**.
- Create anónimo en `/centers/{centerId}/preadmissions/{id}` con payload válido: **permitido**.

### 2.3 Firestore — alta pública de pacientes
- Payload válido actual (campos esperados): **permitido**.
- Payload con campo extra no permitido: **bloqueado**.

### 2.4 Functions — `setSuperAdmin`
- Usuario con claims previos conserva claims (`role`, `centers`, etc.) y agrega `super_admin: true`.
- Registro de auditoría `set_super_admin` continúa generándose.

## 3) Despliegue gradual recomendado

## 3.1 Staging
1. Deploy de reglas y functions en proyecto staging.
2. Ejecutar matriz mínima completa (sección 2).
3. Confirmar que no hay regresión de flujos para staff/center_admin/superadmin.

## 3.2 Smoke test funcional (usuario real de prueba)
1. Login de staff activo.
2. Lectura/escritura de logo según rol.
3. Alta pública (reserva) creando paciente con payload esperado.
4. Intento controlado con payload extra para confirmar bloqueo.
5. Elevación a superadmin verificando merge de claims y log de auditoría.

## 3.3 Producción (ventana controlada)
1. Definir ventana y responsable on-call.
2. Deploy secuencial (rules/functions) según política del equipo.
3. Repetir smoke test mínimo post-deploy.
4. Monitorear errores y métricas operativas durante la ventana.
5. Si falla criterio de aceptación, rollback inmediato con Git + despliegue previo.

## 4) Criterio de aceptación final

- Ningún flujo clínico/rol cambia para usuarios válidos.
- Solo se cierran brechas de reglas/claims detectadas en auditoría.
- No se agregan dependencias nuevas.
