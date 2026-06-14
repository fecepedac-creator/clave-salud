# Diagnóstico integral e identidad del chatbot de Clave Salud (WhatsApp)

Fecha de evaluación: **2026-05-24**.

## 1) Estado técnico actual (diagnóstico completo)

### 1.1 Arquitectura operativa
- El bot vive en `functions/src/whatsapp.ts` y está implementado como función backend con Firebase Admin, Firestore y Gemini. 
- Se observa soporte multi-centro por `phoneNumberId` recibido desde webhook de Meta (`getCenterByPhoneId`), con caché en memoria de 10 minutos para centro + staff.
- Se mantiene una estrategia híbrida: reglas de negocio determinísticas + soporte de IA para clasificación/intención.

### 1.2 Seguridad y hardening
- **Firma webhook**: hay verificación HMAC SHA-256 de `x-hub-signature-256` contra `rawBody`, reduciendo riesgo de suplantación.
- **Secretos críticos**: se esperan `WHATSAPP_TOKEN`, `GEMINI_API_KEY` y `ENCRYPTION_KEY` por variables de entorno.
- **Cifrado token Meta**: tokens de acceso se manejan con AES-256-CBC (incluye compatibilidad legacy en texto plano si falta llave).

### 1.3 Persistencia y datos
- Firestore concentra:
  - `centers` con `whatsappConfig.phoneNumberId` para resolución de tenant.
  - subcolecciones de `staff` activas/visibles para disponibilidad.
  - conversaciones y reservas según flujo del bot.
- El bot descifra `accessToken` del centro al cargar configuración para operar con Meta.

### 1.4 Flujo conversacional real
- En la documentación operativa aún se describe un flujo de **máquina de estados** (FSM) para agenda y handoff.
- La evolución de diseño (documentación de migración) empuja a un modelo más agentic con herramientas y memoria contextual.

### 1.5 Verificación ejecutada en este entorno
- ✅ Suite unitaria del agente WhatsApp: **26/26 tests OK** (`functions/src/__tests__/whatsapp-agent.test.ts`).
- ⚠️ Script de chequeo de configuración productiva no ejecutable aquí por dependencia a credencial local Windows inexistente (`scripts/check_whatsapp_config.cjs` intenta cargar un JSON fuera del entorno actual).

### 1.6 Riesgos y brechas detectadas
1. **Acoplamiento de scripts de diagnóstico a rutas locales** (Windows path hardcodeado), impide auditoría portable en CI/Linux.
2. **Dependencia de secretos de runtime**: si falta `GEMINI_API_KEY` o `WHATSAPP_TOKEN`, el sistema registra error y queda degradado.
3. **Brecha documentación vs implementación**: existe coexistencia de narrativa FSM y arquitectura agentic, lo que puede generar ambigüedad operativa.
4. **Cifrado en modo compatibilidad**: si no hay `ENCRYPTION_KEY`, se permite leer tokens legacy en texto plano (útil para migración, pero con riesgo si se perpetúa).

## 2) Identidad del bot (cómo responde, en qué se basa, valores)

## 2.1 Identidad declarada
Según el perfil funcional de producto, el bot se posiciona como:
- **Nombre/rol**: Asistente virtual de ClaveSalud para el centro específico (ej. Los Andes).
- **Voz**: institucional del centro.
- **Tono**: profesional, empático, formal y resolutivo.

## 2.2 Cómo responde
- Prioriza tareas de agendamiento, disponibilidad y derivación a secretaria (handoff) cuando corresponde.
- Busca evitar invenciones de agenda al operar sobre disponibilidad real persistida en Firestore.
- Mantiene una interacción orientada a cierre (reservar hora o escalar a humano).

## 2.3 En qué se basa para decidir
1. **Contexto del tenant**: `phoneNumberId` del webhook define el centro activo.
2. **Datos operacionales**: staff activo/visible y slots disponibles en base de datos.
3. **Reglas de seguridad/compliance**: validaciones de identidad (ej. RUT en flujo de reserva), no entregar recomendaciones médicas diagnósticas.
4. **Clasificación de intención** (componente IA): para enrutar entre reserva, consulta general o handoff.

## 2.4 Valores operativos del bot
- **Seguridad**: autenticidad de webhook y gestión cifrada de credenciales.
- **Trazabilidad**: persistencia de conversaciones/solicitudes para seguimiento.
- **No maleficencia clínica**: no diagnostica ni prescribe en chat administrativo.
- **Continuidad asistencial**: handoff a secretaria ante casos complejos.
- **Enfoque multi-centro**: respuesta contextual al establecimiento correcto.

## 3) Plan de análisis paso a paso de identidad (próxima sesión sugerida)

1. **Recolectar muestra real** de 30-50 conversaciones anonimizadas.
2. **Etiquetar tono y conducta** (empatía, claridad, formalidad, cierre).
3. **Medir consistencia** con reglas críticas (no diagnóstico, validación de datos, handoff correcto).
4. **Mapear decisiones** (qué señales activan cada respuesta).
5. **Definir guía de estilo final** con ejemplos “sí/no” por tipo de consulta.
6. **Crear métricas de identidad**: tasa de respuestas consistentes, tasa de handoff correcto, tasa de alucinación operacional.

## 4) Conclusión ejecutiva
El chatbot está técnicamente sólido en fundamentos (multi-tenant, seguridad webhook, cifrado, test unitario verde), pero necesita cerrar dos frentes para una madurez operacional completa: **portabilidad de diagnóstico** y **alineación final entre identidad documentada e implementación de comportamiento conversacional**.
