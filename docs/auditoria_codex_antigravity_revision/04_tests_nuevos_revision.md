# 04 — Revisión de Tests Nuevos: Antigravity

A continuación, un análisis pormenorizado de los tests que he credo o refinado dentro de este repositorio.

## 1. `tests/doctor/pscv-flow.spec.ts`

### Qué Valida
El ciclo completo de atención cardiovascular (PSCV):
- Creación de un paciente nuevo con RUT dinámico.
- Llenado de antecedentes médicos (HTA, DM2) y quirúrgicos (Vesícula).
- Datos de seguros (Fonasa Tramo B).
- Registro de Signos Vitales (Presión Arterial, Peso, Talla).
- Registro de Laboratorio (HbA1c, Creatinina, RAC).
- Evaluación de Pie Diabético (Sensibilidad, Pulsos, Riesgo).
- Finalización de consulta y verificación de la información en el historial.

### Supuestos Realizados
-   **Selectores**: Asume que los `data-testid` (como `pscv-vitals-pa`, `pscv-pie-riesgo`) están presentes en el componente `DoctorDashboard.tsx` y sus subcomponentes.
-   **Navegación**: Supone que la función `goToDoctorDashboard` redirige correctamente al dashboard tras cargar el `storageState`.

### Puntos Débiles (Posibles Errores)
-   **Sincronización Clínica**: Algunos elementos (`data-testid`) podrían no aparecer si hay errores cargando Firebase en el navegador. La aserción de "Datos guardados correctamente" es el punto más sensible debido a la latencia de Firestore.

---

## 2. `tests/admin/full-audit.spec.ts`

### Qué Valida
Funcionalidades críticas del Centro Administrativo:
- Login exitoso de Administrador.
- Login exitoso de Profesional.
- Responsividad móvil (SuperAdmin Drawer).
- Restricciones de seguridad (Multi-tenant) para el Admin del Centro A accediendo al Centro B.
- Verificación del portal público del centro médico sin sesión activa.

### Supuestos Realizados
-   **Configuración**: Asume que `TEST.BASE_URL` coincide con el puerto `5175`.
-   **Texto en UI**: Espera encontrar los textos de error exactos como `/No tienes acceso|Sin centros/`.

### Puntos Débiles
-   **Portal Público**: El locator `[data-testid="view-container-center-portal"]` podría haber cambiado, causando un timeout de 15 segundos en el test `E2E-05`.

---
**ESTADO DE PRUEBA**: **NO CONFIRMADO.** Ambos archivos requieren una ejecución exitosa de la autenticación (`auth.setup.ts`) para ser validados contra el producto real.
