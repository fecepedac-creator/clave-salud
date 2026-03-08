# Alineación de Datos con FHIR R4 (Chile Core)

Este documento define la estrategia para que **Clave Salud** sea interoperable bajo el estándar **FHIR (Fast Healthcare Interoperability Resources) R4**, siguiendo específicamente la **Guía de Implementación Core-CL** del MINSAL.

## 1. Mapeo de Entidades Core

| Clave Salud (Firestore) | Recurso FHIR R4 | Perfil Chile Core |
| :---------------------- | :-------------- | :---------------- |
| `Patient`               | `Patient`       | `PacienteCl`      |
| `Consultation`          | `Encounter`     | `EncuentroCl`     |
| `Doctor`                | `Practitioner`  | `PrestadorCl`     |
| `MedicalCenter`         | `Organization`  | `OrganizacionCl`  |
| `VitalSigns`            | `Observation`   | `ObservacionCl`   |
| `Diagnosis`             | `Condition`     | `DiagnosticoCl`   |

## 2. Recurso: Paciente (Patient)

### Identificación
- **RUT**: Se debe mapear al sistema de identificadores de Chile.
  - `system`: `https://hl7chile.cl/fhir/ig/clcore/CodeSystem/CSCodigoDNI` (para RUT).
  - `value`: El RUT sin puntos y con guion.

### Demografía
- `gender`: Mapeo estricto a `male`, `female`, `other`, `unknown`.
- `genderIdentity`: Extensión FHIR para identidad de género (ya presente en nuestra UI).
- `birthDate`: Formato `YYYY-MM-DD`.

## 3. Terminologías Clínicas (Semántica)

Para cumplir con el estándar semántico, debemos transicionar de strings planos a códigos:

- **Diagnósticos**: Usar **SNOMED-CT** (preferido) o **CIE-10**.
- **Medicamentos**: Usar el **TFC** (Terminología Farmacéutica Chilena).
- **Laboratorio**: Usar códigos **LOINC**.

## 4. Próximos Pasos Técnicos

1. **Enriquecer `Patient`**: Agregar campos de metadatos FHIR (ej: `extension` para etnia).
2. **Tablas de Códigos**: Actualizar `constants.ts` para que cada opción (HTA, Diabetes) tenga su código SNOMED-CT asociado.
3. **Módulo de Exportación**: Crear una función que transforme un documento de Firestore en un JSON FHIR válido para interoperabilidad.
