# Runbook - Backups automaticos de Firestore

## 1. Objetivo

Mantener una copia recuperable de la base Firestore de ClaveSalud sin depender de descargas manuales desde el navegador.

La politica activa para el piloto es:

- Ejecutar un backup completo semanal.
- Guardar los ultimos 8 backups semanales.
- Borrar automaticamente los backups mas antiguos.
- Probar restauracion en un proyecto aislado antes de aprobar salida comercial.

## 2. Arquitectura Actual

- Proyecto productivo: `clavesalud-2`.
- Bucket dedicado: `gs://clavesalud-2-firestore-backups`.
- Funcion de backup: `runMonthlyBackup`.
- Funcion de limpieza: `cleanupWeeklyBackups`.
- Scheduler de backup: `firestore-weekly-backup`.
- Scheduler de retencion: `firestore-weekly-backup-retention`.

Aunque la funcion conserva el nombre historico `runMonthlyBackup`, la ejecucion automatica activa es semanal.

## 3. Horario

| Tarea | Frecuencia | Horario | Zona horaria |
|---|---:|---:|---|
| Backup Firestore | Semanal, domingo | 03:30 | America/Santiago |
| Limpieza de retencion | Semanal, domingo | 04:15 | America/Santiago |

La limpieza corre despues del backup para conservar el respaldo recien creado.

## 4. Retencion

La politica activa conserva los ultimos 8 backups bajo:

```text
gs://clavesalud-2-firestore-backups/backups/firestore/
```

Cuando existan mas de 8 backups, `cleanupWeeklyBackups` elimina los prefijos mas antiguos.

El bucket mantiene ademas soft delete por 7 dias como red de seguridad adicional ante borrados recientes.

## 5. Secretos Requeridos

Estos valores deben existir en Firebase Secret Manager:

- `BACKUP_BUCKET`
- `BACKUP_TOKEN`

No deben guardarse en archivos versionados.

## 6. Permisos Requeridos

La cuenta runtime de Functions necesita:

- `roles/datastore.importExportAdmin` en el proyecto `clavesalud-2`.
- Acceso de escritura al bucket `clavesalud-2-firestore-backups`.

El service agent de Firestore del proyecto productivo tambien debe poder escribir en el bucket.

## 7. Verificacion Operativa

Ejecutar:

```bash
npm run ops:verify
```

El comando valida, entre otros puntos:

- Schedulers activos.
- Secrets requeridos.
- `WHATSAPP_TOKEN` como secreto, no como variable plana.
- Existencia de backups.
- Roles canonicos de staff.
- Proyecto de recuperacion disponible.

## 8. Restauracion

La restauracion no se realiza desde la interfaz web.

Procedimiento seguro:

1. Elegir un prefijo de backup.
2. Restaurar primero en proyecto aislado.
3. Verificar conteos basicos.
4. Registrar resultado.
5. Solo despues decidir una restauracion productiva.

Ejemplo:

```bash
gcloud firestore import gs://clavesalud-2-firestore-backups/backups/firestore/YYYY-MM/YYYY-MM-DD_HH-mm-ss \
  --project clave-salud-62998165-597b1
```

## 9. Resultado Probado

Restauracion probada en proyecto aislado:

- Proyecto: `clave-salud-62998165-597b1`.
- Backup probado: `gs://clavesalud-2-firestore-backups/manual/firestore/2026-06-07_23-19-57`.
- Resultado: exitoso.
- Documentos importados: 3.375.

Conteos verificados en restauracion:

- Centros: 3.
- Pacientes: 76.
- Usuarios: 7.
- Invitaciones: 44.
- Staff: 26.
- Citas: 273.

## 10. RPO y RTO Del Piloto

- RPO actual: hasta 7 dias, porque el backup automatico es semanal.
- RTO esperado: horas, dependiendo del tamano de la base y permisos del proyecto destino.

Antes de pasar a produccion comercial abierta, se debe reevaluar si el RPO debe bajar a 24 horas.
