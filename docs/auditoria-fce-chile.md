📌 1. Resumen ejecutivo (máx. 10 líneas)
- Nivel general de cumplimiento: Medio
- Riesgo legal global: Medio
- Alcance: consulta privada/centro médico pequeño con FCE en Firebase (Auth/Firestore/Functions).
- Archivos revisados: firestore.rules; storage.rules; functions/src/index.ts; functions/src/authz.ts; hooks/useCrudOperations.ts; hooks/useFirestoreSync.ts; hooks/useBooking.ts; components/DoctorDashboard.tsx; components/AdminDashboard.tsx; components/ConsultationHistory.tsx; components/PrintPreviewModal.tsx; types.ts.
- Hallazgo principal: control de acceso por centro y roles está implementado, pero no hay registro de accesos ni trazabilidad completa de modificaciones.
- Hallazgo crítico: se permite eliminación de pacientes/atenciones/horas en reglas y UI, sin trazabilidad fuerte ni versionado.
- Copia al paciente: hay impresión de documentos clínicos (recetas) pero no exportación completa de ficha.
- Conservación ≥15 años y política de retención: no se observan mecanismos explícitos.
- Backups: hay descarga/restauración manual, pero no política ni backup automático.

📌 2. Tabla de cumplimiento normativo
Norma / Requisito | Estado (✅ ⚠️ ❌) | Evidencia en el código | Comentario
Ley 20.584 / Confidencialidad de ficha clínica | ✅ | firestore.rules: match /centers/{centerId}/patients allow read solo staff/superadmin【F:firestore.rules†L168-L173】; storage.rules limita logos a staff/admin【F:storage.rules†L37-L44】 | Acceso de lectura restringido a usuarios autenticados del centro.
Ley 20.584 / Acceso solo personal involucrado | ⚠️ | firestore.rules permite lectura a todo staff del centro【F:firestore.rules†L168-L173】 | No hay restricción por paciente/atención; es general por centro.
Ley 20.584 / Disponibilidad para continuidad del cuidado | ⚠️ | AdminDashboard permite descargar/restore backup JSON manual【F:components/AdminDashboard.tsx†L765-L778】 | Hay respaldo manual local, pero no plan de continuidad automatizado.
Ley 20.584 / Conservación ≥ 15 años | ❌ | No encontrado en repo | No hay política/retención explícita ni bloqueo de borrado.
Ley 20.584 / Entrega de copia al paciente | ⚠️ | PrintPreviewModal imprime documentos clínicos (recetas)【F:components/PrintPreviewModal.tsx†L29-L139】; ConsultationHistory permite imprimir documentos emitidos【F:components/ConsultationHistory.tsx†L70-L105】 | Existe impresión de documentos, pero no copia integral de ficha clínica.
DS 41 / Registro clínico cronológico | ⚠️ | ConsultationHistory ordena consultas por fecha (desc)【F:components/ConsultationHistory.tsx†L16-L19】 | Hay orden visual, pero no garantiza inmutabilidad ni bloqueo de reescritura.
DS 41 / Identificación de profesional por atención | ⚠️ | handleCreateConsultation guarda createdBy/createdByUid【F:components/DoctorDashboard.tsx†L435-L459】; Consultation define professionalName/id/role【F:types.ts†L120-L147】 | Se guarda UID creador; faltan campos profesionalName/professionalRole obligatorios en creación.
DS 41 / Prohibición de eliminación silenciosa de atenciones | ❌ | firestore.rules permite delete en consultations/patients/appointments【F:firestore.rules†L168-L174】【F:firestore.rules†L215-L244】; useCrudOperations elimina pacientes/citas【F:hooks/useCrudOperations.ts†L36-L107】 | No hay soft-delete ni bloqueo de delete en reglas.
DS 41 / Asociación paciente ↔ atención ↔ profesional | ⚠️ | Consultations se guardan con patientId/centerId/createdByUid【F:components/DoctorDashboard.tsx†L435-L459】 | Asociación parcial; falta profesional explícito y consistencia entre colección y subdocumento en paciente.
DS 41 / Registro de accesos (lecturas) | ❌ | No encontrado en repo | No hay logging de lecturas en frontend ni functions.
DS 41 / Registro de modificaciones (quién/cuándo/qué) | ⚠️ | AuditLogEntry y updateAuditLog【F:types.ts†L37-L46】【F:hooks/useCrudOperations.ts†L132-L141】; App genera logs manuales【F:App.tsx†L1584-L1638】 | Hay logs manuales para ciertas acciones, no cubre todas las modificaciones ni es automático.
DS 41 / Reconstrucción de historial (versionado, soft-delete) | ❌ | No encontrado en repo | No hay versionado ni historial de cambios; borrados son definitivos.
DS 41 / Control de acceso por rol/centro en reglas | ✅ | firestore.rules usa staff/role/centerId para acceso【F:firestore.rules†L35-L244】 | Control de acceso básico por centro/rol.
DS 41 / Prevención de accesos indebidos entre centros | ✅ | Reglas segmentan por /centers/{centerId} y validan staff del centro【F:firestore.rules†L122-L173】 | Aislamiento por centro en reglas.
DS 41 / Riesgo cuentas compartidas (2FA/políticas) | ❌ | No encontrado en repo | No hay controles técnicos de cuentas compartidas ni 2FA en el código.
DS 41 / Backups y soporte electrónico | ⚠️ | AdminDashboard backup/restore manual【F:components/AdminDashboard.tsx†L765-L778】 | Respaldo manual disponible; falta procedimiento automatizado.
DS 41 / Dependencia cloud razonable | ✅ | Uso de Firebase/Firestore como backend (configuración general)【F:hooks/useFirestoreSync.ts†L58-L101】 | Dependencia cloud es razonable para consulta privada si hay backup y control de acceso.
Ley 19.628 / Datos sensibles y medidas de seguridad | ⚠️ | Reglas de acceso Firestore y Storage restringen lectura/escritura【F:firestore.rules†L122-L244】【F:storage.rules†L37-L44】 | Medidas de acceso básicas; falta trazabilidad completa y políticas.
Ley 19.628 / Principio de finalidad | ❌ | No encontrado en repo | No se observan términos/consentimiento ni política explícita de finalidad.
Ley 19.628 / Riesgos de exposición (URLs públicas/logs) | ⚠️ | Lectura pública limitada a horarios disponibles【F:firestore.rules†L68-L88】【F:hooks/useFirestoreSync.ts†L80-L88】 | No hay Storage público; pero creación pública de pacientes y ausencia de logging elevan riesgo operacional.
Ley 19.628 / Medidas razonables para centro pequeño | ⚠️ | Roles/centro en reglas y audit logs manuales【F:firestore.rules†L122-L244】【F:hooks/useCrudOperations.ts†L132-L141】 | Base razonable, pero incompleta para trazabilidad y retención.

📌 3. Riesgos reales detectados
- Eliminación definitiva de atenciones/pacientes sin trazabilidad ni versión.
  - Nivel: Alto
  - Probabilidad de observación por SEREMI: Alta
- Ausencia de registro de accesos a fichas clínicas.
  - Nivel: Alto
  - Probabilidad de observación por SEREMI: Media
- Identificación incompleta del profesional por atención (solo UID técnico).
  - Nivel: Medio
  - Probabilidad de observación por SEREMI: Media
- Conservación ≥15 años sin política ni mecanismo.
  - Nivel: Medio
  - Probabilidad de observación por SEREMI: Media
- Backups solo manuales, sin plan documentado.
  - Nivel: Medio
  - Probabilidad de observación por SEREMI: Media
- Riesgo operacional por cuentas compartidas (sin 2FA ni trazabilidad completa).
  - Nivel: Medio
  - Probabilidad de observación por SEREMI: Media

📌 4. Recomendaciones mínimas (NO sobredimensionar)
- Bloquear delete directo de consultations/patients/appointments en reglas y usar “soft-delete” con marca deletedAt + motivo + actorUid. Prioridad: Alta.
- Registrar accesos de lectura a fichas (evento mínimo con actorUid, patientId, timestamp) en auditLogs. Prioridad: Alta.
- Completar identificación del profesional por atención (professionalName/professionalId/role) al crear la consulta y fijarla como inmutable. Prioridad: Media.
- Definir política interna de conservación ≥15 años (documento y configuración operativa) y evitar borrados; solo desactivar. Prioridad: Alta.
- Formalizar backups: rutina mensual de exportación JSON y resguardo seguro (disco cifrado o nube privada). Prioridad: Media.
- Establecer política de cuentas individuales (no compartidas) y uso de 2FA cuando se habilite en Firebase Auth. Prioridad: Media.

📌 5. Conclusión
- ¿El sistema es defendible hoy ante fiscalización sanitaria?
  Parcialmente: cumple control de acceso básico, pero carece de trazabilidad de accesos/modificaciones y permite borrado definitivo.
- ¿Qué cambios mínimos lo dejan en “zona segura”?
  Bloqueo de deletes con soft-delete, registro de accesos, completar identificación profesional en cada atención, y formalizar retención/backup.
