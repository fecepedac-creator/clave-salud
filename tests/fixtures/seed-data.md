# Seed Data — Dataset Mínimo para Playwright E2E

Este documento describe el conjunto de datos mínimo que debe existir en Firestore
para que los tests 1–10 tengan aserciones determinísticas.

## Centro de Pruebas

| Campo | Valor |
|---|---|
| `centerId` | `c_eji2qv61` |
| `centerName` | "Los Andes Test" (o el nombre real del centro) |
| `mes` | El mismo valor de `TEST_YEAR_MONTH` en `.env.test` |

---

## Doctor de Prueba (Doctor A)

**Colección:** `centers/c_eji2qv61/staff/{TEST_DOCTOR_ID}`

```json
{
  "id": "ksVwqXA7VUPuglYzlXNhnqLOeiw1",
  "fullName": "Dr. Test A",
  "email": "doctor.test@clavesalud.cl",
  "role": "MEDICO",
  "clinicalRole": "MEDICO",
  "active": true,
  "visibleInBooking": true,
  "centerId": "c_eji2qv61"
}
```

---

## Stats del Doctor A

**Colección:** `centers/c_eji2qv61/stats_professional_month/ksVwqXA7VUPuglYzlXNhnqLOeiw1_{YYYY-MM}`

```json
{
  "doctorId": "ksVwqXA7VUPuglYzlXNhnqLOeiw1",
  "yearMonth": "2026-03",
  "totalAppointments": 10,
  "completed": 7,
  "noShow": 2,
  "cancelled": 1,
  "billableCount": 7,
  "totalAmountBillable": 350000
}
```

> **Notas:**
> - `totalAppointments = completed + noShow + cancelled` → 7 + 2 + 1 = **10 ✓**
> - `billableCount ≤ completed` → 7 ≤ 7 **✓**
> - Monto por cita: $50.000 CLP × 7 = **$350.000 ✓**

---

## Stats del Centro

**Colección:** `centers/c_eji2qv61/stats_center_month/{YYYY-MM}`

```json
{
  "yearMonth": "2026-03",
  "totalAppointments": 10,
  "completed": 7,
  "noShow": 2,
  "cancelled": 1,
  "billableCount": 7,
  "totalAmountBillable": 350000
}
```

---

## Estado de Cierre del Mes

**Colección:** `centers/c_eji2qv61/closures_month/{YYYY-MM}`

Para que Tests 2 y 3 comiencen correctamente, el mes debe estar **ABIERTO**:

```json
{
  "yearMonth": "2026-03",
  "status": "open",
  "closedAt": null,
  "closedBy": null
}
```

Si el documento no existe, el sistema lo trata como abierto (comportamiento default).

---

## Doctor B (solo para Tests 8/9 — multi-tenant)

**Colección:** `centers/c_eji2qv61/staff/{TEST_DOCTOR_B_ID}`

```json
{
  "id": "doctor_test_uid_002",
  "fullName": "Dr. Test B",
  "email": "doctor.b.test@clavesalud.cl",
  "role": "MEDICO",
  "active": true,
  "centerId": "c_eji2qv61"
}
```

**Stats del Doctor B:** `centers/c_eji2qv61/stats_professional_month/doctor_test_uid_002_{YYYY-MM}`

```json
{
  "doctorId": "doctor_test_uid_002",
  "yearMonth": "2026-03",
  "totalAppointments": 5,
  "completed": 4,
  "totalAmountBillable": 200000
}
```

---

## Cómo Popular los Datos Manualmente

Hasta que el seed script exista, ejecutar desde la **Consola de Firebase**:

```javascript
// En Firebase Console > Firestore > Ejecutar en la consola del navegador:
const db = firebase.firestore();
const centerId = "c_eji2qv61";
const yearMonth = "2026-03";
const doctorId = "ksVwqXA7VUPuglYzlXNhnqLOeiw1";

// Stats del doctor
await db
  .collection("centers").doc(centerId)
  .collection("stats_professional_month")
  .doc(`${doctorId}_${yearMonth}`)
  .set({
    doctorId, yearMonth,
    totalAppointments: 10, completed: 7, noShow: 2, cancelled: 1,
    billableCount: 7, totalAmountBillable: 350000
  });

// Stats del centro
await db
  .collection("centers").doc(centerId)
  .collection("stats_center_month")
  .doc(yearMonth)
  .set({
    yearMonth,
    totalAppointments: 10, completed: 7, noShow: 2, cancelled: 1,
    billableCount: 7, totalAmountBillable: 350000
  });

console.log("✅ Seed completado");
```
