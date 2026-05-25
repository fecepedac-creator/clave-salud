# Auditoria integral por modulos y pestanas - ClaveSalud

Fecha: 2026-05-25  
Rama evaluada: `codex/auditoria-clinica-progresiva`  
Tipo: revision de codigo local, sin deploy, sin migraciones destructivas.

## Objetivo

Revisar la ficha clinica electronica completa con tres criterios principales:

- Simple y facil de usar para profesionales de salud.
- Alineada con resguardo legal-operativo de ficha clinica, datos sensibles y trazabilidad.
- Preparada para incorporar IA de forma segura, auditable y util para reducir carga administrativa.

## Estado ejecutivo

El sistema tiene una base funcional amplia: panel medico, agenda, ficha clinica, recetas, vademecum, examenes, portal de reserva, WhatsApp, administracion de centros, auditoria y superadmin. La arquitectura ya incorpora mejoras relevantes de seguridad: acceso por centro, reglas de Firestore, callable backend para crear consultas, validacion de recetas y control de uso de modos demo/local.

Los focos que quedan como prioridad son:

- Completar trazabilidad transversal de acciones clinicas criticas, no solo de acceso.
- Homogeneizar UX de flujos clinicos para que cada seccion tenga guardado/estado/errores consistentes.
- Llevar toda IA clinica a backend, con logs de generacion, aceptacion y descarte.
- Separar claramente IA clinica, IA administrativa y marketing.
- Fortalecer validaciones backend para adjuntos, examenes, informes y acciones de agenda.

## IA clinica por backend

### Estado actual

Archivos revisados:

- `utils/gemini.ts`
- `utils/clinicalAi.ts`
- `features/doctor/components/ProfessionalConsultationForm.tsx`
- `functions/src/index.ts`
- `components/MarketingFlyerModal.tsx`
- `components/PrescriptionManager.tsx`

El boton "Asistente IA" de anamnesis ahora usa `improveClinicalText`, una Cloud Function protegida con `GEMINI_API_KEY`. Esto evita exponer la llave clinica en el frontend y permite aplicar permisos por centro antes de enviar texto a Gemini.

La integracion clinica quedo separada de la IA de marketing: `utils/clinicalAi.ts` solo usa callables backend, mientras `utils/gemini.ts` queda reservado para copy de marketing.

Se agrego auditoria de ciclo de uso:

- `AI_CLINICAL_TEXT_SUGGESTED`: se genero una sugerencia.
- `AI_CLINICAL_TEXT_ACCEPTED`: el profesional acepto la sugerencia.
- `AI_CLINICAL_TEXT_DISCARDED`: el profesional descarto la sugerencia.

Los logs registran metadatos minimos: centro, usuario, campo, paciente cuando existe, largo de entrada y salida. No guardan el texto clinico crudo en auditoria.

Mejoras aplicadas en esta fase:

- Prompts clinicos versionados por campo: `clinical_anamnesis@1.1.0`, `clinical_physical_exam@1.0.0`, `clinical_indications@1.0.0`.
- Botones IA con revision obligatoria en anamnesis, examen fisico e indicaciones/plan.
- Comparador simple de posibles datos agregados: alerta terminos presentes en salida pero no en entrada para revision profesional.
- Metadata de uso ampliada: `promptId`, `promptVersion`, `warningCount`, largos de entrada/salida y largo final aceptado.
- Panel administrativo "Uso IA" con sugerencias, aceptadas, descartadas, alertas, campos usados y tiempo ahorrado estimado.
- Filtros del panel "Uso IA" por rango de fecha, usuario/profesional y campo clinico.
- Auditoria `AI_CLINICAL_TEXT_FINALIZED` al guardar consulta para medir edicion posterior real por largo final y delta porcentual.
- Feedback administrativo de alertas: `AI_CLINICAL_ALERT_CONFIRMED` y `AI_CLINICAL_ALERT_FALSE_POSITIVE`.
- Instrucciones asistidas por rol para medico, enfermeria/TENS, kinesiologia, psicologia, nutricion, matrona y odontologia.
- IA de marketing movida a backend mediante `generateMarketingCaption`, usando `GEMINI_API_KEY` como secret y auditando el uso no clinico.

### Evaluacion clinica

Fortalezas:

- La IA actua como apoyo de redaccion, no como diagnostico.
- La sugerencia no se aplica automaticamente.
- El profesional conserva control final.
- El prompt prohibe inventar signos, sintomas, examenes, tratamientos o evolucion.
- La funcion valida que el usuario tenga pertenencia activa al centro.
- Si se informa paciente, backend valida que pertenezca al centro antes de generar o registrar uso IA.

Riesgos remanentes:

- La IA de marketing ya usa backend, pero conviene mantener separada su auditoria de la auditoria clinica.
- El comparador actual es heuristico y no reemplaza revision profesional; sirve como alerta inicial, no como bloqueo semantico definitivo.
- El impacto por especialidad depende de que el rol/especialidad del usuario este bien normalizado en staff.

### Recomendaciones

P0:

- Mantener toda IA clinica exclusivamente por backend.
- Auditar generacion, aceptacion y descarte sin almacenar texto sensible en logs.
- Bloquear uso clinico si no hay `centerId` o usuario activo.

P1:

- Mantener el panel "Uso IA" con revision operacional mensual.
- Refinar gradualmente el comparador con casos reales marcados como confirmados/falsos positivos.
- Usar `AI_CLINICAL_TEXT_FINALIZED` para monitorear campos con alta edicion posterior.

P2:

- Evolucionar instrucciones por rol hacia plantillas configurables por centro/especialidad.
- Crear revision visual por especialidad cuando haya suficiente volumen de eventos.
- Separar dashboards clinicos y marketing si el volumen de IA no clinica aumenta.

## Auditoria modulo por modulo

### 1. App, autenticacion y rutas

Archivos principales:

- `App.tsx`
- `hooks/useAuth.ts`
- `components/VerifyDocument.tsx`

Estado: funcional con mejoras recientes para limitar modos demo/master a entorno local o bandera explicita.

Hallazgos:

- La aplicacion centraliza muchos modos de vista, lo que aumenta riesgo de regresion en rutas.
- Los accesos especiales ya no deben quedar activos en produccion salvo bandera explicita.
- La verificacion publica de documentos depende de busquedas amplias si no hay identificadores fuertes.

Mejoras:

- Registrar auditoria de cambios de modo/contexto en usuarios administrativos.
- Separar rutas publicas, medicas y admin en un router mas declarativo.
- Exigir identificador firmado para verificacion de documentos.

### 2. SuperAdmin

Pestanas:

- General
- Centros
- Finanzas
- Comunicacion
- Metricas
- Usuarios

Archivos principales:

- `components/SuperAdminDashboard.tsx`
- `features/superadmin/components/SuperAdminGeneral.tsx`
- `features/superadmin/components/SuperAdminCenters.tsx`
- `features/superadmin/components/SuperAdminFinance.tsx`
- `features/superadmin/components/SuperAdminCommunications.tsx`
- `features/superadmin/components/SuperAdminMetrics.tsx`
- `features/superadmin/components/SuperAdminUsers.tsx`

Estado: modulo completo, con alta capacidad operativa.

Hallazgos:

- Es el modulo con mayor privilegio, por lo que cada accion debe quedar auditada.
- El manejo de logos y Storage tiene fallback para preview, correcto para desarrollo, pero debe quedar visible en runbook.
- La configuracion de modulos por centro es clave; requiere historial de cambios.

Mejoras:

- Bitacora obligatoria para crear/editar/desactivar centros, usuarios y modulos.
- Confirmacion fuerte para cambios de facturacion o permisos.
- Vista de "riesgo operativo" por centro: sin agenda, sin staff activo, sin WhatsApp, sin reglas de receta.

### 3. Admin centro

Pestanas:

- Command Center
- Profesionales
- Agenda
- WhatsApp
- Marketing
- Auditoria
- Preadmisiones
- Servicios
- Rendimiento
- Campanas

Archivos principales:

- `components/AdminDashboard.tsx`
- `features/admin/components/AdminCommandCenter.tsx`
- `features/admin/components/ProfessionalManagement.tsx`
- `features/admin/components/AdminAgenda.tsx`
- `features/admin/components/WhatsappSettings.tsx`
- `components/MarketingPosterModule.tsx`
- `components/AuditLogViewer.tsx`
- `features/admin/components/PreadmissionList.tsx`
- `components/ServicesManager.tsx`
- `features/admin/components/AdminPerformanceTab.tsx`
- `components/CampaignManager.tsx`

Estado: amplio y operativo; se corrigio persistencia de cancelacion desde Command Center.

Hallazgos:

- Command Center debe ser la consola de secretaria/administracion: necesita estados claros y trazabilidad.
- Agenda y WhatsApp son flujos de alto impacto; los errores deben escalar a secretaria o dejar tarea pendiente.
- Marketing usa IA no clinica; conviene separar la llave y auditar consumo.
- Preadmisiones es buena solucion para no perder reservas cuando no se puede crear paciente raiz.

Mejoras:

- Crear tareas administrativas automaticamente desde fallas de WhatsApp, preadmision incompleta o cancelaciones.
- Estandarizar estados: pendiente, confirmado, cancelado, no asistio, requiere contacto.
- Agregar auditoria para cambios de horario, profesional, cancelacion y reactivacion.

### 4. Panel medico

Pestanas:

- Pacientes
- Agenda
- Rendimiento
- Configuracion

Archivos principales:

- `components/DoctorDashboard.tsx`
- `features/doctor/components/DoctorPatientsListTab.tsx`
- `features/doctor/components/DoctorAgendaTab.tsx`
- `features/doctor/components/DoctorPerformanceTab.tsx`
- `features/doctor/components/DoctorSettingsTab.tsx`

Estado: funcional y orientado al trabajo diario.

Hallazgos:

- La ficha prioriza el flujo profesional, pero aun mezcla bastantes responsabilidades en componentes grandes.
- La mascara de PII es positiva para privacidad.
- Rendimiento y agenda dependen de consistencia de estados de citas.

Mejoras:

- Atajos clinicos por rol y especialidad.
- Indicadores visibles de "ficha incompleta" antes de guardar.
- Borrador local/autoguardado de consulta con recuperacion.

### 5. Ficha clinica del paciente

Submodulos:

- Header de paciente
- Sidebar clinico
- Historial de consultas
- Nueva atencion
- Adjuntos
- Impresion/PDF
- Informe clinico
- Ordenes de examenes

Archivos principales:

- `features/doctor/components/DoctorPatientRecord.tsx`
- `features/doctor/components/DoctorPatientHeader.tsx`
- `components/PatientSidebar.tsx`
- `components/ConsultationHistory.tsx`
- `components/ConsultationDetailModal.tsx`
- `components/FullClinicalRecordPrintView.tsx`
- `components/PrintPreviewModal.tsx`
- `components/ClinicalReportModal.tsx`
- `components/ExamOrderModal.tsx`

Estado: modulo central robusto, con riesgo natural por amplitud clinica.

Hallazgos:

- Los adjuntos se guardan en Storage bajo ruta de usuario; conviene alinear ruta con centro/paciente y reglas backend.
- El historial legacy se muestra con advertencia, correcto durante transicion.
- Impresion e informes son sensibles legalmente: requieren firma, fecha, profesional y trazabilidad clara.

Mejoras:

- Validacion backend para adjuntos: tipo, tamano, centro, paciente y permisos.
- Registro de auditoria al descargar/imprimir ficha completa.
- Versionado de informes clinicos emitidos.

### 6. Nueva atencion clinica

Secciones:

- Motivo y anamnesis
- Signos vitales / PSCV
- Examen fisico
- Diagnostico
- Recetas e indicaciones
- Examenes
- Plan y proximo control

Archivos principales:

- `features/doctor/components/ProfessionalConsultationForm.tsx`
- `components/PSCVForm.tsx`
- `components/VitalsForm.tsx`
- `components/PrescriptionManager.tsx`
- `components/ExamSheetsSection.tsx`
- `hooks/doctor/useConsultationLogic.ts`
- `functions/src/index.ts`

Estado: el flujo ya tiene callable backend para guardar consulta y validar recetas.

Hallazgos:

- Buen avance: guardar consulta ya no depende solo de reglas frontend.
- El boton IA de anamnesis quedo con revision obligatoria.
- Examen fisico y plan aun dependen de texto libre sin apoyo estructurado.
- Los diagnosticos combinan SNOMED y texto libre; esto es practico, pero requiere distinguir origen.

Mejoras:

- Checklist minimo por tipo de consulta antes de guardar.
- IA de apoyo por campo, no generica: anamnesis, examen fisico, plan, indicaciones.
- Guardado con estado: borrador, finalizada, corregida/anulada.
- Auditoria de modificaciones post-guardado.

### 7. Recetas, vademecum e indicaciones

Archivos principales:

- `components/PrescriptionManager.tsx`
- `utils/vademecum.ts`
- `constants/vademecum_isp.json`
- `hooks/doctor/useConsultationLogic.ts`
- `functions/src/index.ts`
- `firestore.rules`

Estado: reforzado parcialmente en frontend, reglas y callable backend.

Fortalezas:

- Deteccion de medicamentos controlados.
- Cambio automatico a receta retenida cuando corresponde y rol lo permite.
- Validacion backend de rol y contenido controlado antes de escribir consulta.
- Tests de vademecum cubren escenarios relevantes.

Riesgos:

- El vademecum debe tratarse como ayuda, no como fuente regulatoria unica.
- Inyectables requieren mas contexto: via, dosis, profesional autorizado, administracion en centro o indicacion externa.
- Controlados necesitan mayor formalidad documental y trazabilidad de emision/impresion.

Mejoras:

- Fuente ISP versionada con fecha de actualizacion visible.
- Reglas especificas para inyectables y controlados.
- Firma avanzada o al menos hash verificable para documentos emitidos.
- Auditoria de impresion, descarga y anulacion de recetas.

### 8. Agenda y reservas

Archivos principales:

- `components/AgendaView.tsx`
- `features/admin/components/AdminAgenda.tsx`
- `features/doctor/components/DoctorAgendaTab.tsx`
- `hooks/useBooking.ts`
- `components/BookingPortal.tsx`
- `components/PatientPortal.tsx`

Estado: funcional; se mejoro cancelacion persistente y preadmision fallback.

Hallazgos:

- La agenda es eje operacional y debe evitar doble reserva, estados ambiguos y perdida de solicitudes.
- Portal publico necesita mensajes simples y botones claros.
- Cancelaciones deben quedar con actor, razon y hora.

Mejoras:

- Callable backend para crear/cancelar/reagendar con validacion atomica.
- Bloqueo de doble reserva mediante transaccion.
- Lista administrativa de "acciones pendientes" derivadas del portal.

### 9. WhatsApp bot

Archivos principales:

- `functions/src/whatsapp.ts`
- `features/admin/components/WhatsappSettings.tsx`
- `components/WhatsappTemplatesManager.tsx`
- `docs/whatsapp-bot/*`

Estado: se reforzo identidad, urgencias, preparacion de examenes, frustracion y handoff.

Fortalezas:

- Prompt de administrador virtual.
- Reglas deterministicas antes de IA.
- Firma/token mejorado en webhook.
- Runner de identidad disponible.

Riesgos:

- Dependencia de configuracion correcta de Meta/Gemini/secrets.
- Necesita monitoreo de handoffs y fallas.
- Debe evitar prometer disponibilidad o precios sin fuente.

Mejoras:

- Panel de conversaciones fallidas y derivadas.
- Metricas: handoff correcto, alucinacion operacional, cierre accionable.
- Plantillas de respuesta institucional por tipo de consulta.

### 10. Auditoria, reglas y backend

Archivos principales:

- `firestore.rules`
- `functions/src/index.ts`
- `functions/src/immutableAudit.ts`
- `hooks/useAuditLog.ts`
- `components/AuditLogViewer.tsx`

Estado: en fortalecimiento activo.

Fortalezas:

- Reglas para pacientes raiz y subcolecciones de consultas.
- Auditoria inmutable para escritura clinica critica.
- Callables para acciones sensibles.

Riesgos:

- Algunas rutas frontend todavia escriben directamente.
- Firestore rules tienen warning heredado de ternario; compila en dry-run pero conviene limpiar.
- No todas las acciones clinicas tienen evento de auditoria legible para medico/administrador.

Mejoras:

- Mapa unico de eventos auditables.
- Convertir acciones criticas restantes a callable backend.
- Dashboard de auditoria con filtros por paciente, usuario, accion, fecha y severidad.

## Backlog priorizado

### P0 - Seguridad clinica y legal

- Mantener IA clinica solo por backend y auditar uso.
- Completar callables backend para agenda, adjuntos, informes y anulaciones.
- Validar permisos por centro/paciente antes de toda escritura clinica.
- Auditar impresion/descarga de ficha, receta e informe.
- Eliminar o resolver conflictos existentes en `docs/audits/README.md` antes de automatizar indices.

### P1 - UX profesional y continuidad operativa

- Autoguardado de borrador de consulta.
- Checklist de ficha incompleta antes de finalizar.
- Estados uniformes de agenda y solicitudes administrativas.
- Panel de tareas para secretaria.
- IA por campo clinico con prompts versionados.

### P2 - Inteligencia operacional

- Dashboard de uso IA.
- Analisis de productividad por profesional y centro.
- Alertas de pacientes sin control o examenes pendientes.
- Sugerencias de plantillas por especialidad.
- Motor de calidad documental: campos vacios, textos ambiguos, falta de plan o seguimiento.

## Conclusion

ClaveSalud esta en un buen punto para avanzar desde una ficha clinica funcional a una plataforma clinico-operacional mas profesional: menos texto repetitivo para el profesional, mas controles backend para seguridad, y auditoria mas clara para cumplir responsabilidades legales y administrativas.

La recomendacion es seguir con lotes progresivos pequenos: primero cerrar callables y auditoria de acciones criticas, luego mejorar UX de cada flujo clinico, y finalmente expandir IA con metricas reales de calidad y adopcion.
