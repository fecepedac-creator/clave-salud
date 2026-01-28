# Sistema de Auditoría de Accesos (DS 41 MINSAL)

## Descripción General

Este sistema implementa la trazabilidad de accesos a datos clínicos conforme al Decreto Supremo 41 del MINSAL (Ministerio de Salud de Chile), que requiere el registro de quién accede a datos clínicos de pacientes y cuándo.

## Arquitectura

### 1. Colección Firestore

Los logs de auditoría se almacenan en:
```
centers/{centerId}/auditLogs/{logId}
```

Cada documento contiene:
```javascript
{
  type: "ACCESS",
  actorUid: string,           // UID del usuario que accedió
  actorEmail: string,          // Email del usuario
  actorRole: string,           // Rol del usuario (doctor, center_admin, etc.)
  patientId?: string,          // ID del paciente (opcional)
  resourceType: "patient" | "consultation" | "appointment",
  resourcePath: string,        // Ruta completa del recurso accedido
  timestamp: ServerTimestamp,  // Timestamp del servidor
  ip?: string,                 // IP del usuario (opcional)
  userAgent?: string          // User agent del navegador (opcional)
}
```

### 2. Reglas de Seguridad Firestore

Las reglas de seguridad garantizan que:
- ✅ Solo staff y superadmins pueden **leer** los logs
- ❌ **Ningún cliente** puede escribir directamente los logs
- ✅ Solo Cloud Functions pueden crear logs
- ❌ Los logs no pueden ser actualizados ni eliminados

```javascript
match /auditLogs/{logId} {
  allow read: if signedIn() && (isSuperAdmin() || isStaff(centerId));
  allow create, update, delete: if false;
}
```

### 3. Cloud Function `logAccess`

Ubicación: `functions/src/index.ts`

Características:
- **Autenticación requerida**: Solo usuarios autenticados pueden registrar accesos
- **Verificación de permisos**: El usuario debe ser staff del centro o superadmin
- **Deduplicación**: Un mismo usuario no puede registrar acceso al mismo recurso más de una vez en 60 segundos
- **Timestamps del servidor**: Garantiza integridad temporal de los registros

#### Uso desde el cliente:

```typescript
import { getFunctions, httpsCallable } from "firebase/functions";

const functions = getFunctions();
const logAccessFn = httpsCallable(functions, "logAccess");

await logAccessFn({
  centerId: "centro123",
  resourceType: "patient",
  resourcePath: "centers/centro123/patients/patient456",
  patientId: "patient456"
});
```

### 4. Hook React `useAuditLog`

Ubicación: `hooks/useAuditLog.ts`

Simplifica el uso de la Cloud Function desde componentes React:

```typescript
import { useAuditLog } from "../hooks/useAuditLog";

function MyComponent() {
  const { logAccess, loading, error } = useAuditLog();
  
  const handleSelectPatient = async (patient) => {
    // ... lógica de selección
    
    await logAccess({
      centerId: activeCenterId,
      resourceType: "patient",
      resourcePath: `centers/${activeCenterId}/patients/${patient.id}`,
      patientId: patient.id
    });
  };
  
  return (/* ... */);
}
```

## Puntos de Integración

### Accesos Registrados Actualmente:

1. **Apertura de ficha de paciente** (`DoctorDashboard.tsx`)
   - Cuando un usuario hace clic en un paciente de la lista
   - Cuando se abre un paciente desde una cita agendada

### Puntos de Integración Futuros:

2. **Visualización de consultas médicas**
   - Al abrir historial de consultas completo
   - Al acceder a consultas específicas

3. **Exportación/Descarga de PDFs**
   - Al generar PDFs de recetas médicas
   - Al exportar historiales clínicos

## Deduplicación

El sistema implementa deduplicación para evitar logs repetitivos:

- **Ventana temporal**: 60 segundos
- **Criterio**: Usuario + Recurso
- **Implementación**: Documento temporal en Firestore con ID predecible
- **Comportamiento**: Si un usuario intenta registrar acceso al mismo recurso dentro de 60 segundos, se rechaza el segundo intento

Ejemplo:
```
Usuario: doctor123
Recurso: centers/centro1/patients/patient456
Tiempo 1: 10:00:00 → ✅ Log creado
Tiempo 2: 10:00:30 → ❌ Rechazado (30 segundos)
Tiempo 3: 10:01:05 → ✅ Log creado (65 segundos)
```

## Compatibilidad y Retroactividad

### ✅ Garantías de Compatibilidad:

1. **Campos opcionales**: Todos los campos opcionales (`patientId`, `ip`, `userAgent`) pueden omitirse
2. **Fallo silencioso**: Si el logging falla, no bloquea el flujo del usuario
3. **Sin interferencia**: El sistema existente funciona sin modificaciones
4. **Independiente**: Los logs están separados de la lógica de negocio

### ⚠️ Consideraciones:

- Los logs no se retroaplican a accesos anteriores
- El sistema solo registra accesos desde la implementación en adelante
- Los usuarios existentes no requieren cambios de configuración

## Pruebas

### Pruebas Manuales:

1. **Verificar creación de logs**:
   ```javascript
   // En la consola de Firestore, navegar a:
   centers/{tu_centro}/auditLogs
   // Debería ver documentos con timestamp reciente
   ```

2. **Verificar deduplicación**:
   - Abrir un paciente
   - Cerrar y volver a abrir el mismo paciente inmediatamente
   - Verificar en Firestore que solo hay un log

3. **Verificar permisos de lectura**:
   - Como staff: Debería poder leer logs del propio centro
   - Como paciente: No debería tener acceso a logs

4. **Verificar permisos de escritura**:
   - Intentar crear un log directamente desde el cliente (debe fallar)
   - Solo la Cloud Function debe poder crear logs

### Comandos de Prueba:

```bash
# Construir Cloud Functions
cd functions
npm run build

# Construir Frontend
cd ..
npm run build

# Iniciar emuladores locales (opcional)
firebase emulators:start
```

## Monitoreo y Consultas

### Consultar logs de un paciente específico:

```javascript
const logsRef = collection(db, `centers/${centerId}/auditLogs`);
const q = query(
  logsRef,
  where("patientId", "==", patientId),
  orderBy("timestamp", "desc"),
  limit(100)
);
const snapshot = await getDocs(q);
```

### Consultar logs por rango de tiempo:

```javascript
const startDate = new Date("2024-01-01");
const endDate = new Date("2024-01-31");

const q = query(
  logsRef,
  where("timestamp", ">=", startDate),
  where("timestamp", "<=", endDate),
  orderBy("timestamp", "desc")
);
```

### Consultar logs por usuario:

```javascript
const q = query(
  logsRef,
  where("actorUid", "==", userId),
  orderBy("timestamp", "desc"),
  limit(100)
);
```

## Índices Requeridos

Para optimizar las consultas, se recomienda crear los siguientes índices en Firestore:

```
Collection: centers/{centerId}/auditLogs
Indexes:
  1. patientId (ASC) + timestamp (DESC)
  2. actorUid (ASC) + timestamp (DESC)
  3. timestamp (DESC)
  4. resourceType (ASC) + timestamp (DESC)
```

## Seguridad y Cumplimiento

### ✅ Cumplimiento DS 41 MINSAL:

- [x] Registro de quién accede (actorUid, actorEmail, actorRole)
- [x] Registro de cuándo accede (timestamp del servidor)
- [x] Registro de qué accede (resourcePath, resourceType, patientId)
- [x] Inmutabilidad de logs (no se pueden editar ni eliminar)
- [x] Acceso restringido a logs (solo staff autorizado)

### 🔒 Consideraciones de Seguridad:

1. **No almacenar datos sensibles en logs**: Los logs solo contienen IDs y rutas, no contenido médico
2. **Timestamps del servidor**: Evita manipulación de timestamps por clientes
3. **Permisos granulares**: Solo staff del centro correspondiente puede ver logs
4. **Auditoría de auditorías**: Los accesos a logs también pueden ser monitoreados

## Mantenimiento

### Limpieza de Logs Antiguos:

Considerar implementar una política de retención:
- Logs mayores a 2 años pueden archivarse
- Usar Cloud Functions programadas para archivado automático

### Copia de Seguridad:

Los logs de auditoría deben incluirse en las copias de seguridad regulares de Firestore para cumplimiento normativo.

## Soporte y Contacto

Para preguntas o problemas con el sistema de auditoría:
- Revisar los logs de Cloud Functions en Firebase Console
- Verificar las reglas de seguridad en Firestore
- Contactar al equipo de desarrollo

## Changelog

### v1.0.0 (Enero 2024)
- ✅ Implementación inicial de auditoría de accesos
- ✅ Cloud Function `logAccess` con deduplicación
- ✅ Hook React `useAuditLog`
- ✅ Integración en DoctorDashboard (apertura de pacientes)
- ✅ Reglas de seguridad Firestore
- ✅ Documentación completa
