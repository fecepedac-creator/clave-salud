# 00 — Estado Git Real: Antigravity Final

A continuación se detalla la situación exacta del repositorio de ClaveSalud según la inspección directa del sistema de archivos y el control de versiones (Git).

## 1. Salida de `git status --short`
```bash
 M .firebase/hosting.ZGlzdA.cache
 M App.tsx
 M components/AdminDashboard.tsx
 M components/MarketingFlyerModal.tsx
 M components/PatientDetail.tsx
 M components/PatientForm.tsx
 M components/PatientSidebar.tsx
 M components/PrintPreviewModal.tsx
 M components/SuperAdminDashboard.tsx
 M features/doctor/components/DoctorPatientRecord.tsx
 M features/doctor/components/DoctorPatientsListTab.tsx
 M firestore.indexes.json
 M firestore.rules
 M functions/src/index.ts
 M functions/src/whatsapp.ts
 M hooks/doctor/useConsultationLogic.ts
 M package-lock.json
 M package.json
 M tests/auth/auth.setup.ts
 M types.ts
 M utils/gemini.ts
?? MARKET_READINESS_REPORT.md
?? audit_report.txt
?? audit_report_utf8.txt
?? components/BookingPortal.tsx
?? components/HomeDirectory.tsx
?? components/PSCVForm.tsx
?? components/PatientPortal.tsx
?? docs/auditoria_codex/
?? docs/auditoria_codex_antigravity_revision/
?? docs/auditoria_codex_antigravity_final/
?? scripts/audit_isolation_fixed.cjs
?? tests/doctor/pscv-flow.spec.ts
?? tests/test_failure.txt
```

## 2. Clasificación de Archivos Modificados/Nuevos

### Producto Frontend (UI/Lógica React)
-   `App.tsx`
-   `components/AdminDashboard.tsx`
-   `components/MarketingFlyerModal.tsx`
-   `components/PatientDetail.tsx`
-   `components/PatientForm.tsx`
-   `components/PatientSidebar.tsx`
-   `components/PrintPreviewModal.tsx`
-   `components/SuperAdminDashboard.tsx`
-   `features/doctor/components/DoctorPatientRecord.tsx`
-   `features/doctor/components/DoctorPatientsListTab.tsx`
-   `types.ts`
-   `utils/gemini.ts`
-   `components/BookingPortal.tsx` (Nuevo)
-   `components/HomeDirectory.tsx` (Nuevo)
-   `components/PSCVForm.tsx` (Nuevo)
-   `components/PatientPortal.tsx` (Nuevo)

### Backend / Cloud Functions
-   `functions/src/index.ts`
-   `functions/src/whatsapp.ts`

### Reglas Firebase e Índices
-   `firestore.rules`
-   `firestore.indexes.json`

### Tests
-   `tests/auth/auth.setup.ts`
-   `tests/doctor/pscv-flow.spec.ts` (Nuevo)
-   `tests/test_failure.txt`

### Documentación
-   `MARKET_READINESS_REPORT.md`
-   `docs/auditoria_codex/`
-   `docs/auditoria_codex_antigravity_revision/`
-   `docs/auditoria_codex_antigravity_final/`

### Scripts
-   `scripts/audit_isolation_fixed.cjs`

### Configuración
-   `package.json`
-   `package-lock.json`
-   `.firebase/hosting.ZGlzdA.cache`
-   `.env.test` (Modificado hoy, aunque Git no lo muestre por estar ignorado)
