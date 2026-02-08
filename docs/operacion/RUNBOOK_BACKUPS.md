# Runbook — Backups automáticos mensuales (Firestore → GCS)

## 1) Arquitectura
- **Cloud Scheduler** ejecuta mensualmente la función HTTPS `runMonthlyBackup`.
- **Cloud Function (v1)** exporta Firestore con la API Admin de Firestore y guarda los archivos en **GCS**.
- Se escribe un `manifest.json` en el mismo prefijo del backup con metadata de la ejecución.

## 2) Variables requeridas (Functions config / env)
Configurar en `firebase functions:config:set` o variables de entorno:
- `backup.bucket` / `BACKUP_BUCKET`: nombre del bucket GCS (obligatorio).
- `backup.prefix` / `BACKUP_PREFIX`: prefijo base (opcional, default `backups/firestore`).
- `backup.token` / `BACKUP_TOKEN`: token compartido para Scheduler (recomendado).
- `backup.projectid` / `GCLOUD_PROJECT`: proyecto Firebase/GCP (se autodetecta en GCP).
- `BACKUP_ACCESS_TOKEN`: **solo para pruebas locales** si no hay metadata server.

Ejemplo:
```
firebase functions:config:set backup.bucket="mi-bucket-backups" backup.token="TOKEN_LARGO"
```

## 3) APIs y permisos mínimos
Habilitar APIs:
- Firestore Admin API
- Cloud Scheduler API
- Cloud Storage API

Service Account para Scheduler (recomendado):
- `roles/datastore.importExportAdmin` (solo export)
- `roles/storage.objectAdmin` **solo** sobre el bucket de backups

Bucket:
- Uniform access habilitado.
- Encriptación por defecto habilitada.

## 4) Crear Cloud Scheduler (mensual)
Ejemplo (UTC):
```
gcloud scheduler jobs create http firestore-monthly-backup \
  --schedule="30 6 1 * *" \
  --time-zone="America/Santiago" \
  --uri="https://<REGION>-<PROJECT_ID>.cloudfunctions.net/runMonthlyBackup" \
  --http-method=POST \
  --headers="X-Backup-Token: TOKEN_LARGO" \
  --message-body='{"reason":"SCHEDULED_MONTHLY","initiatedBy":"cloud-scheduler","dryRun":false}' \
  --oidc-service-account-email="<SCHEDULER_SA>@<PROJECT_ID>.iam.gserviceaccount.com"
```
> Ajustar horario y región. Si usas OIDC, puedes mantener el token header como segundo factor o removerlo.

## 5) Verificación
- Logs en Cloud Functions → `runMonthlyBackup`.
- Listar backups:
```
gsutil ls gs://<BUCKET>/backups/firestore/
```
- Revisar `manifest.json` en el prefijo generado.

## 6) Restauración (import)
**Advertencia:** importa sobreescribiendo datos. Usar primero un proyecto staging.
```
gcloud firestore import gs://<BUCKET>/backups/firestore/YYYY-MM/YYYY-MM-DD_HH-mm-ss
```

## 7) Alcance / limitaciones
- **Cubre solo Firestore.** No incluye Firebase Storage.
- Se recomienda un plan de respaldo adicional si se usan muchos adjuntos en Storage.

## 8) Retención sugerida
- Recomendado conservar al menos **24 meses** de backups mensuales.
- Limpieza automática opcional no incluida (puede añadirse en otro ciclo).

## 9) Checklist DR (centro pequeño)
- **RPO:** hasta 30 días (backup mensual).
- **RTO:** horas (depende de tamaño y operación).
- Verificar export mensual en logs + manifest.
- Probar restauración en staging 1 vez por trimestre.
