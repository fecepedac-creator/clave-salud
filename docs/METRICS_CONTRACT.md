# Contrato de Métricas Unificado

Para asegurar la escalabilidad de Clave Salud y minimizar costos de lectura en Firestore, todas las métricas de dashboards se basan en **agregados materializados** en cada documento de centro.

## Ubicación del Dato
- **Colección**: `centers/{centerId}`
- **Campo**: `stats` (objeto)

## Estructura del Objeto `stats`
```json
{
  "totalPatients": 1500,
  "totalStaff": 25,
  "totalAppointments": 450,
  "totalConsultations": 380,
  "updatedAt": "2026-02-21T12:00:00Z"
}
```

## Políticas de Consumo (Frontend)
1. **Dashboard SuperAdmin**: Calcula totales globales sumando el campo `stats` de todos los centros cargados en memoria. NO usar `collectionGroup` para conteos en tiempo real.
2. **Dashboard Centro**: Muestra directamente los valores de `center.stats`.
3. **Mantenimiento**: Si `stats` no existe o está vacío, la UI debe mostrar "Sin datos" o un estado neutro, evitando placeholders estáticos (mocks).

## Actualización (Backend)
Las métricas se actualizan vía **Cloud Functions** (Triggers de Firestore) o Tareas Programadas cada 24 horas, persistiendo el resultado en el campo `stats` del centro correspondiente.
