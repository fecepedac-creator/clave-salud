---
name: "AuditSuspicionEngine"
description: "Habilidad para detectar patrones de acceso anómalos o sospechosos en los logs de auditoría de Clave Salud, alineada con marcos de ciberseguridad clínica."
---

# AuditSuspicionEngine: Detector de Anomalías

Esta habilidad dota al asistente de la capacidad de supervisar la integridad del acceso a la información, identificando riesgos antes de que se conviertan en brechas de datos.

## Capacidades
1. **Detección de Accesos Masivos**: Identifica si un solo usuario consulta más de 10 fichas clínicas en un intervalo de 1 minuto (posible raspado de datos).
2. **Análisis por Centro**: Detecta cuando un profesional intenta acceder a datos de un `centerId` al que no está vinculado.
3. **Alertas de Horario Inusual**: Identifica accesos a fichas críticas en horarios no laborales (ej: 3:00 AM) si no hay una guardia documentada.
4. **Nivel de Riesgo**: Clasifica las actividades en BAJO, MEDIO o CRÍTICO según la severidad del patrón detectado.

## Seguridad y Privacidad
- **Falsos Positivos**: El agente debe consultar al administrador antes de tomar acciones de bloqueo definitivas.
- **Registro de Alerta**: Toda sospecha detectada debe generar un log especial en el panel de SuperAdmin.

## Herramientas
- `scripts/detect_suspicious_activity.js`: Script para procesar flujos de logs y encontrar patrones de sospecha.

## Instrucciones de Uso
Activar cuando se pida: "Revisa si hay actividad inusual hoy", "Analiza estos logs de acceso", o "¿Ha habido algún intento de acceso masivo recientemente?".
