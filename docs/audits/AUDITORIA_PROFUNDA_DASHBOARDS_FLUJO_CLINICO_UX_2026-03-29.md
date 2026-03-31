# Auditoría profunda — Dashboards, flujo clínico y UX (ClaveSalud)

Fecha de corte: 2026-03-29.

## 0) Enfoque multiagente aplicado
- **UX/UI Senior:** evaluación de claridad, jerarquía, navegación, estados vacíos, errores y carga cognitiva.
- **Médico usuario experto:** evaluación de utilidad clínica, coherencia de datos y seguridad en uso real.
- **Frontend Architect:** evaluación de estructura de componentes, hooks, re-render y duplicación de lógica.
- **Product Owner clínico:** evaluación de alineación entre operación clínica y objetivos de producto.

---

## 1) Mapa de dashboards (admin, doctor, rendimiento, agenda)

## 1.1 Dashboard Admin (centro)
**Tabs detectadas:**
- `command_center`, `doctors`, `agenda`, `whatsapp`, `marketing`, `audit`, `preadmissions`, `services`, `performance`.

**Dependencias funcionales clave:**
- Orquestación central en `AdminDashboard` con múltiples submódulos.
- KPIs y operaciones sensibles (agenda, auditoría, preingresos, rendimiento) en el mismo nivel de navegación.

## 1.2 Dashboard Doctor
**Tabs detectadas:**
- `patients`, `agenda`, `settings`, `performance` (y `reminders` en definición de estado).

**Dependencias funcionales clave:**
- Lista de pacientes + agenda + modal operacional de cita (WhatsApp/cierre) + settings del profesional.
- Flujo clínico real distribuido entre tabs y modales.

## 1.3 Dashboard de Rendimiento
- **Admin:** tab `performance` dentro de `AdminDashboard`.
- **Doctor:** `DoctorPerformanceTab` condicionado por `activeCenterId`.

## 1.4 Vista Agenda
- **Admin Agenda:** configuración y operación de agenda por centro.
- **Doctor Agenda:** agenda operativa del profesional (incluye vista administrativo seleccionando médico).

---

## 2) Problemas críticos por vista (clasificados)

## 2.1 Vista Admin Dashboard

### CRÍTICO
1. **Exceso de densidad funcional en una sola barra de tabs (9 frentes operativos en horizontal).**
   - Impacto: navegación de alto costo cognitivo, especialmente en escritorio reducido y móvil.
   - Efecto clínico-operacional: tareas urgentes (agenda/preingresos) compiten visualmente con tareas no críticas.

### ALTO
2. **Métricas de command center mezclan fuentes en vivo y fallback local sin claridad semántica.**
   - Ej.: `activeCenter.stats.* || arrays.length` para KPIs de pacientes/citas/profesionales.
   - Riesgo: decisiones sobre datos con origen ambiguo (snapshot histórico vs estado local).

3. **Preingresos presenta listado volumétrico sin priorización clínica explícita.**
   - Falta triage visual por riesgo, urgencia, antigüedad o completitud documental.

### MEDIO
4. **Tab bar horizontal con scroll (`overflow-x-auto`) sin agrupación por objetivos.**
   - Usuarios administrativos nuevos pueden perder discoverability.

5. **Mensajería de error heterogénea (toast + consola) sin patrón estándar de recuperación.**

### BAJO
6. **Inconsistencias de nomenclatura funcional (“Centro de Mando”, “Rendimiento”, “Prestaciones / Exámenes”).**

---

## 2.2 Vista Doctor Dashboard

### CRÍTICO
1. **Flujo clínico fragmentado entre lista, agenda, modal y enlaces externos (WhatsApp) sin guardas clínicas suficientes.**
   - Riesgo de interrupción del contexto clínico y pérdida de continuidad en acciones de seguimiento.

2. **Exposición de PII en modal de cita (RUT + teléfono) con acciones rápidas de mensajería.**
   - Riesgo de uso inseguro en estaciones compartidas y potencial shoulder surfing.

### ALTO
3. **Dependencia fuerte de componentes “tab” gigantes por props drilling masivo.**
   - Señal de acoplamiento entre dominio clínico, UX y estado de UI.

4. **Estados de agenda/pacientes no estandarizados para empty, loading y degraded mode.**
   - Hay mensajes puntuales, pero no estrategia unificada por contexto clínico.

### MEDIO
5. **Comentarios de código indican deuda viva (“tab buttons removed or commented out”).**
   - Potencial de divergencia entre intención UX y estado real de UI.

6. **CTA flotante de “Reportar Problema” fija en vista clínica puede competir con acciones primarias.**

### BAJO
7. **Terminología mixta operativa/técnica en la misma vista (profesional/administrativo/módulos).**

---

## 2.3 Vista Agenda (Admin y Doctor)

### CRÍTICO
1. **Carga de citas con límite alto y filtrado client-side en hook global.**
   - Riesgo de performance y latencia en centros con alta densidad de agenda.
   - Riesgo secundario: variabilidad del comportamiento según volumen real.

### ALTO
2. **No hay jerarquía clínica explícita en “día ocupado” (urgencia, primera vez, control, no-show riesgo).**

3. **Manejo de acciones rápidas (confirmar/cancelar/abrir ficha) muy cerca visualmente en celdas de agenda.**
   - Riesgo de error de ejecución por click equivocado.

### MEDIO
4. **Estados vacíos correctos pero básicos (“No hay pacientes agendados para este día”).**
   - Falta “next best action” contextual (crear bloque, ampliar horario, contactar lista de espera).

### BAJO
5. **Diferencias menores de estilo entre agenda admin y doctor reducen sensación de sistema unificado.**

---

## 2.4 Vista Rendimiento

### ALTO
1. **Rendimiento separado del flujo diario, sin puente operacional directo.**
   - El usuario ve métricas, pero no siempre obtiene “acción recomendada” inmediata.

### MEDIO
2. **KPIs sin semáforo clínico-operativo unificado (tendencia, umbral, desviación esperada).**

### BAJO
3. **Taxonomía de indicadores no explícita (operacional vs clínico vs comercial).**

---

## 2.5 Flujo clínico (paciente, consulta, ficha)

### CRÍTICO
1. **Coexistencia de rutas/dominios de paciente-consulta en modelos distintos (root y por centro).**
   - Impacto: riesgo de incoherencia entre lectura clínica, editor de equipo tratante y auditoría.

2. **Edición de care team en ruta `centers/{centerId}/patients/{patientId}` coexistiendo con modelo raíz `/patients`.**
   - Riesgo clínico: acceso/restricción no alineado en todos los puntos de lectura.

### ALTO
3. **Exportación de ficha con confirmación vía `window.confirm` en escenarios de alta carga de atenciones.**
   - UX frágil para una operación legal/clínica crítica.

4. **Historial clínico robusto visualmente, pero sin “resumen clínico orientado a decisión” persistente.**
   - El médico debe escanear bloques extensos para tomar decisiones rápidas.

### MEDIO
5. **Borradores/IA en reportes clínicos requieren más guardrails de validación antes de emisión formal.**

### BAJO
6. **Variabilidad terminológica (consulta, atención, sesión) según módulo.**

---

## 3) Problemas de UX (transversales)

### CRÍTICO
1. **Arquitectura de navegación por vista global (`view`) y path syncing manual aumenta estados ambiguos.**
   - Back/forward y redirecciones automáticas pueden generar “saltos” de contexto percibidos.

### ALTO
2. **Jerarquía de información insuficiente para rol administrativo y clínico en pantallas densas.**
3. **Patrones de error no homogéneos (toasts, textos sueltos, fallback silencioso).**
4. **Estados vacíos sin guía de acción en módulos críticos (agenda/rendimiento/preingresos).**

### MEDIO
5. **Microcopy mezcla lenguaje técnico, legal y operativo en una misma capa visual.**
6. **Escasez de affordances para confirmar acciones de alto impacto clínico.**

### BAJO
7. **Pequeñas inconsistencias visuales entre módulos afectan percepción de calidad.**

---

## 4) Problemas técnicos (arquitectura frontend)

### CRÍTICO
1. **`App.tsx` concentra routing, auth, center selection, redirecciones E2E, vistas y composición de paneles.**
   - Resultado: alto acoplamiento + riesgo de regresión cruzada.

2. **`useFirestoreSync` es un hook “god object” (pacientes, staff, agenda, logs, preadmisiones, servicios).**
   - Resultado: frontera de responsabilidad difusa y tuning complejo de performance.

### ALTO
3. **Prop drilling masivo en tabs del dashboard doctor/admin.**
4. **Lógica de autorización/rol dispersa en varios niveles (App, hooks, componentes).**
5. **Estrategia de fetch de citas orientada a evitar índices, desplazando costo a cliente.**

### MEDIO
6. **Patrones legacy coexistentes (comentarios y rutas de compatibilidad) incrementan complejidad mental.**
7. **Manejo de errores predominantemente por `console.*` + toast, sin capa central de observabilidad UI.**

### BAJO
8. **Nombres y responsabilidades de algunos componentes no reflejan bounded context clínico estricto.**

---

## 5) Oportunidades de mejora de alto impacto

1. **Separar shell de navegación y routing por dominio** (portal público, workspace clínico, superadmin).
2. **Refactor por vertical slices** (Pacientes, Agenda, Consultas, Rendimiento, Configuración).
3. **Diseñar un “Clinical Decision Header”** en ficha/paciente con resumen mínimo seguro:
   - diagnóstico activo,
   - último control,
   - alertas,
   - adherencia/no-show,
   - próximos hitos.
4. **Unificar estado de datos clínicos en un modelo canónico** y encapsular adaptadores legacy.
5. **Definir un Design System operacional-clínico** para:
   - estados vacíos,
   - errores recuperables/no recuperables,
   - confirmación de acciones críticas,
   - badges de riesgo clínico.
6. **Subir inteligencia de agenda a nivel de priorización** (triage visual, riesgo de ausentismo, prioridad clínica).

---

## 6) Propuestas de rediseño concretas

## 6.1 Rediseño dashboard admin (alto impacto)
- **Estructura propuesta:**
  1) Operación diaria (Agenda + Preingresos + Alertas)
  2) Equipo clínico (Profesionales + Servicios)
  3) Gobernanza (Auditoría + Configuración)
  4) Growth (WhatsApp + Marketing + Rendimiento)
- **Resultado esperado:** reducción de carga cognitiva y time-to-task para tareas críticas.

## 6.2 Rediseño dashboard doctor
- **Layout de 3 capas:**
  - capa 1: resumen clínico activo del paciente seleccionado,
  - capa 2: timeline de consultas + acciones clínicas,
  - capa 3: herramientas (órdenes, plantillas, comunicación).
- **Guardas de seguridad UX:** masking parcial de PII por defecto en contextos no focales.

## 6.3 Rediseño agenda
- **Agenda por prioridad clínica y operacional:**
  - chips de riesgo (no-show, control vencido, primera consulta, crónico),
  - quick actions con confirmación contextual,
  - sugerencias automáticas en estados vacíos.

## 6.4 Rediseño flujo ficha clínica
- **Modelo “episodio clínico unificado”**: toda consulta, documento y orden colgando de una entidad clínica canónica.
- **Exportación segura:** reemplazar `confirm()` por wizard con selección de alcance + validación legal + auditoría explícita.

---

## 7) Plan priorizado por severidad

## CRÍTICO (0–2 semanas)
1. Separar `App.tsx` en router por dominios + guardas de sesión/rol.
2. Dividir `useFirestoreSync` en hooks por dominio (patients, appointments, logs, preadmissions, services).
3. Definir modelo canónico paciente-consulta y congelar escrituras legacy.
4. Hardening UX de PII en agenda/modal clínico.

## ALTO (2–6 semanas)
1. Reorganizar IA de navegación en Admin por objetivos operativos.
2. Unificar estrategia de errores/empty/loading por design tokens.
3. Reducir prop drilling con contextos por dashboard + selectors memoizados.
4. Introducir KPI con semáforos y acción recomendada.

## MEDIO (6–10 semanas)
1. Normalizar terminología clínica-operativa.
2. Mejorar accesibilidad y consistencia visual cross-modules.
3. Añadir observabilidad UI (trazas de UX + performance frontend).

## BAJO (10+ semanas)
1. Ajustes cosméticos y de microcopy no bloqueantes.

---

## 8) Resumen ejecutivo
- El sistema es funcional y rico en capacidades, pero muestra **densidad operativa elevada**, **acoplamiento técnico** y **deuda de coherencia clínica de datos** en puntos críticos.
- La mayor ganancia de valor está en: **(1) simplificar navegación por objetivos clínicos, (2) unificar modelo paciente/consulta, (3) desacoplar arquitectura frontend por dominios**.
- Priorizar estas tres líneas reduce simultáneamente riesgo clínico, fricción UX y costo de mantenimiento.
