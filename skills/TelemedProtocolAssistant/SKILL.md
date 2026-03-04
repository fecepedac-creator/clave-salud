---
name: "TelemedProtocolAssistant"
description: "Habilidad para asegurar que las atenciones de telemedicina cumplan con los estándares técnicos y éticos de la norma chilena NCh3442."
---

# TelemedProtocolAssistant: Estándar de Telemedicina

Esta habilidad capacita al asistente para supervisar que las consultas remotas se realicen bajo un marco de seguridad, privacidad y calidad clínica reglamentada.

## Capacidades
1. **Verificación de Consentimiento**: Asegura que se haya registrado el consentimiento informado específico para telemedicina antes de iniciar el registro clínico.
2. **Validación de Identidad**: Instruye al profesional sobre la necesidad de verificar la identidad del paciente al inicio de la conexión.
3. **Privacidad de la Sesión**: Solicita confirmar que tanto el profesional como el paciente se encuentran en un entorno privado y seguro.
4. **Registro de Contingencia**: Provee pautas sobre qué hacer en caso de fallo técnico durante la consulta (ej: cambio de canal a llamada telefónica).
5. **Idoneidad Clínica**: Alerta si el motivo de consulta sugiere una urgencia que no pueda ser resuelta mediante telemedicina.

## Seguridad y Privacidad
- **Encriptación**: Promueve el uso de canales seguros de comunicación integrados o autorizados.
- **Tratamiento de Datos**: Los registros de telemedicina se integran a la ficha única con una etiqueta de "Atención Remota" para transparencia legal.

## Herramientas
- `scripts/validate_telemed_session.js`: Script para validar campos obligatorios en el registro de una teleconsulta.

## Instrucciones de Uso
Activar cuando se identifique una consulta remota, al usar términos como "Inicia teleconsulta", "Cita virtual", o al revisar una ficha con modalidad "Telemedicina".
