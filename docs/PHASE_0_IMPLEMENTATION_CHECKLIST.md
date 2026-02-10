# Fase 0 — Preparación y respaldo (inicio de implementación)

Objetivo: iniciar la implementación del plan de mejoras sin cambiar el comportamiento actual de la app.

## 1) Rama de trabajo

- Crear rama dedicada para hardening:
  - `fix/security-rules-hardening`
- Confirmar que la rama parte desde el estado estable actual.

## 2) Respaldo operativo (rollback rápido)

Guardar snapshot de los archivos críticos antes de cambiar lógica:

- `firestore.rules`
- `storage.rules`
- `functions/src/index.ts`

Comandos sugeridos:

```bash
mkdir -p backups/phase-0
cp firestore.rules backups/phase-0/firestore.rules.bak
cp storage.rules backups/phase-0/storage.rules.bak
cp functions/src/index.ts backups/phase-0/functions-index.ts.bak
```

> Nota: estos backups locales son de trabajo. Para rollback real en producción, usar además historial de Git y despliegue controlado.

## 3) Criterios de no regresión (baseline)

Antes de aplicar cambios de Fases 1–4, validar baseline actual:

- Build frontend OK.
- Build functions OK.
- Flujo de login staff/admin/superadmin se mantiene.
- Preadmisión pública por centro continúa operativa.
- Gestión de claims superadmin sin cambios aún (solo referencia para luego comparar).

## 4) Registro de evidencia

Crear una minuta mínima de ejecución de Fase 0 con:

- Fecha/hora
- Responsable
- Commit base
- Resultado de checks
- Riesgos detectados antes de intervenir

Plantilla:

```md
## Fase 0 ejecutada
- Fecha: YYYY-MM-DD HH:mm
- Responsable: <nombre>
- Commit base: <sha>
- Frontend build: OK/FAIL
- Functions build: OK/FAIL
- Observaciones: ...
```

## 5) Puerta de salida de Fase 0

Solo pasar a Fase 1 si:

- Existe rama dedicada.
- Se respaldaron archivos críticos.
- Baseline validado.
- Evidencia registrada.

