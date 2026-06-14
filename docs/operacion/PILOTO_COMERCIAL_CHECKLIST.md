# Checklist de activacion del piloto comercial

Este documento debe completarse por cada centro antes de habilitar usuarios reales. El piloto inicial
solo incluye ficha clinica, profesionales, agenda, preingresos y auditoria.

## 1. Contencion y credenciales

- [ ] Rotar `GEMINI_API_KEY`, `ENCRYPTION_KEY`, tokens de WhatsApp y cualquier credencial expuesta.
- [ ] Invalidar tokens anteriores y revisar su uso reciente.
- [ ] Purgar secretos historicos del repositorio con una herramienta como `git filter-repo`.
- [ ] Ejecutar `npm run security:secrets` y confirmar que el CI queda en verde.
- [ ] Confirmar que las credenciales Firebase Admin locales siguen ignoradas por Git.

## 2. Alta asistida del centro

- [ ] Registrar responsable clinico y responsable operativo.
- [ ] Asignar membresias canonicas: `center_admin`, `administrative` y `professional`.
- [ ] Mantener `clinicalRole` separado del rol de acceso.
- [ ] Verificar que administradores no clinicos no puedan leer ni modificar evoluciones medicas.
- [ ] Verificar que secretarias solo accedan a agenda, preingresos y contacto minimo.
- [ ] Confirmar aislamiento del centro alterando manualmente la URL.

## 3. Modulos habilitados

- [ ] Habilitar ficha clinica, profesionales, agenda, preingresos y auditoria.
- [ ] Mantener `VITE_ENABLE_ADVANCED_WHATSAPP=false`.
- [ ] Mantener `VITE_ENABLE_AI_USAGE=false`.
- [ ] Mantener `VITE_ENABLE_CAMPAIGNS=false`.
- [ ] Mantener `VITE_ENABLE_MARKETING=false`.
- [ ] Mantener `VITE_ENABLE_MANUAL_CLINICAL_BACKUP=false`.
- [ ] Mantener `VITE_ENABLE_BROWSER_CLINICAL_MIGRATION=false`.

## 4. Auditoria y continuidad

- [ ] Confirmar trazabilidad de lectura, impresion, exportacion, modificacion y archivado de ficha.
- [ ] Probar cierre mensual: una cita cerrada no admite cambios de fecha, asistencia ni monto.
- [ ] Definir retencion de datos clinicos por al menos 15 anos.
- [x] Configurar backup semanal automatico de Firestore.
- [x] Configurar retencion automatica de los ultimos 8 backups semanales.
- [x] Ejecutar restauracion de prueba en proyecto aislado.
- [ ] Registrar responsable operativo por centro para revisar alertas de backup.
- [ ] Ejecutar `npm run ops:verify` antes de cada activacion de centro.

## 5. Autenticacion y salida

- [ ] Probar Google Auth profesional en `http://localhost:5175`.
- [ ] Probar Google Auth profesional en el dominio productivo.
- [ ] Probar login de SuperAdmin y seleccion de centro.
- [ ] Realizar revision legal y de seguridad externa antes de incorporar centros ajenos.

## Comandos de verificacion

```bash
npm run security:secrets
npm run security:commercial
npm run ops:verify
npm run build
npx tsc --noEmit
npm --prefix functions run build
```
