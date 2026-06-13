# Respaldo y recuperacion

## Alcance

Los respaldos productivos de ClaveSalud se ejecutan desde servidor mediante Cloud Functions y Cloud Scheduler.

Durante el piloto:

- No se usa descarga JSON desde navegador para datos clinicos.
- No se restaura desde la interfaz web.
- Toda restauracion debe probarse primero en un proyecto aislado.

## Politica Activa

- Backup completo de Firestore una vez por semana.
- Ejecucion: domingo 03:30 AM, `America/Santiago`.
- Retencion: ultimos 8 backups semanales.
- Limpieza: domingo 04:15 AM, `America/Santiago`.
- Bucket: `gs://clavesalud-2-firestore-backups`.

## Componentes

| Componente | Nombre |
|---|---|
| Funcion de backup | `runMonthlyBackup` |
| Funcion de limpieza | `cleanupWeeklyBackups` |
| Scheduler de backup | `firestore-weekly-backup` |
| Scheduler de retencion | `firestore-weekly-backup-retention` |
| Proyecto productivo | `clavesalud-2` |
| Proyecto de recuperacion probado | `clave-salud-62998165-597b1` |

## Verificacion Regular

Ejecutar:

```bash
npm run ops:verify
```

Este comando debe pasar antes de considerar saludable el estado operativo.

## Restauracion Controlada

1. Seleccionar un backup.
2. Confirmar que el proyecto destino no contiene datos productivos activos.
3. Ejecutar importacion Firestore en el proyecto aislado.
4. Verificar conteos de centros, pacientes, usuarios, staff y citas.
5. Registrar fecha, responsable, prefijo restaurado, duracion y resultado.
6. Decidir si se conserva o elimina el entorno de recuperacion.

## Prueba Real Registrada

| Fecha | Respaldo | Proyecto destino | Resultado | Conteos |
|---|---|---|---|---|
| 2026-06-12 | `gs://clavesalud-2-firestore-backups/manual/firestore/2026-06-07_23-19-57` | `clave-salud-62998165-597b1` | Exitosa | 3 centros, 76 pacientes, 7 usuarios, 26 staff, 273 citas |

## Nota De Costos

El proyecto de recuperacion tiene billing activo y presupuesto de alerta de 1.000 CLP.

La alerta no es un bloqueo duro de gasto. Si el entorno deja de usarse, se debe evaluar desvincular billing o eliminar recursos.
