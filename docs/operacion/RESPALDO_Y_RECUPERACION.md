# Respaldo y recuperacion

## Alcance

Los respaldos clinicos productivos se ejecutan desde servidor mediante `runMonthlyBackup`. La descarga
JSON desde navegador y la restauracion manual desde el panel permanecen deshabilitadas durante el
piloto.

## Configuracion requerida

- Configurar `BACKUP_BUCKET` con un bucket privado dedicado.
- Configurar `BACKUP_TOKEN` como secreto para Cloud Scheduler.
- Aplicar retencion y versionado del bucket segun la politica del centro.
- Restringir lectura y restauracion a personal de continuidad autorizado.

## Ejecucion

1. Ejecutar primero `POST runMonthlyBackup` con `{ "dryRun": true, "reason": "PILOT_CHECK" }`.
2. Confirmar la creacion del manifiesto en el bucket privado.
3. Ejecutar el respaldo real con un motivo operativo.
4. Registrar fecha, centro, responsable, prefijo GCS y resultado.

## Restauracion controlada

La restauracion no se realiza desde la interfaz web. Debe ejecutarse en un proyecto aislado antes de
aprobar el piloto.

1. Seleccionar un respaldo y registrar su manifiesto.
2. Restaurar en un proyecto Firebase de recuperacion sin usuarios productivos.
3. Verificar conteos de centros, pacientes, consultas, citas y auditorias.
4. Validar acceso con cuentas de prueba para `center_admin`, `administrative` y `professional`.
5. Registrar tiempo total de recuperacion, diferencias encontradas y responsable.
6. Destruir el entorno temporal segun el procedimiento interno.

## Registro de prueba

| Fecha | Respaldo | Responsable | Duracion | Resultado | Diferencias |
|---|---|---|---|---|---|
| Pendiente | Pendiente | Pendiente | Pendiente | Pendiente | Pendiente |
