const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../components/DoctorDashboard.tsx');
let code = fs.readFileSync(targetFile, 'utf8');

const importStr = `import { DoctorPatientRecord } from "../features/doctor/components/DoctorPatientRecord";\n`;
if (!code.includes('DoctorPatientRecord')) {
    code = code.replace(
        'import { DoctorSettingsTab } from "../features/doctor/components/DoctorSettingsTab";',
        'import { DoctorSettingsTab } from "../features/doctor/components/DoctorSettingsTab";\n' + importStr
    );
}

// Find the start of the block
const startPattern = '// --- RENDER SELECTED PATIENT ---';
const startIndex = code.indexOf(startPattern);

// Find the start of the next section
const endPattern = '// --- RENDER PATIENT LIST / DASHBOARD LANDING ---';
const endIndex = code.indexOf(endPattern);

if (startIndex !== -1 && endIndex !== -1) {
    const replacement = `// --- RENDER SELECTED PATIENT ---
  if (selectedPatient) {
    return (
      <DoctorPatientRecord
        selectedPatient={selectedPatient}
        setSelectedPatient={setSelectedPatient}
        isEditingPatient={isEditingPatient}
        setIsEditingPatient={setIsEditingPatient}
        handleSavePatient={handleSavePatient}
        onUpdatePatient={onUpdatePatient}
        onLogActivity={onLogActivity}
        
        activeCenterId={activeCenterId ?? ""}
        activeCenter={activeCenter}
        hasActiveCenter={hasActiveCenter}
        moduleGuards={moduleGuards}
        
        doctorName={doctorName}
        doctorId={doctorId}
        role={role}
        currentUser={currentUser}
        isReadOnly={isReadOnly}
        
        newConsultation={newConsultation}
        setNewConsultation={setNewConsultation}
        isCreatingConsultation={isCreatingConsultation}
        setIsCreatingConsultation={setIsCreatingConsultation}
        handleVitalsChange={handleVitalsChange}
        handleExamChange={handleExamChange}
        handleCreateConsultation={handleCreateConsultation}
        selectedPatientConsultations={selectedPatientConsultations}
        isUsingLegacyConsultations={isUsingLegacyConsultations}
        
        docsToPrint={docsToPrint}
        setDocsToPrint={setDocsToPrint}
        isPrintModalOpen={isPrintModalOpen}
        setIsPrintModalOpen={setIsPrintModalOpen}
        isClinicalReportOpen={isClinicalReportOpen}
        setIsClinicalReportOpen={setIsClinicalReportOpen}
        
        selectedConsultationForModal={selectedConsultationForModal}
        setSelectedConsultationForModal={setSelectedConsultationForModal}
        
        isExamOrderModalOpen={isExamOrderModalOpen}
        setIsExamOrderModalOpen={setIsExamOrderModalOpen}
        examOrderCatalog={examOrderCatalog}
        
        myExamProfiles={myExamProfiles}
        allExamOptions={allExamOptions}
        myTemplates={myTemplates}
        
        sendConsultationByEmail={sendConsultationByEmail}
        safeAgeLabel={safeAgeLabel}
      />
    );
  }

  `;

    code = code.slice(0, startIndex) + replacement + code.slice(endIndex);
    fs.writeFileSync(targetFile, code, 'utf8');
    console.log('Refactoring successfully applied.');
} else {
    console.error('Could not find the target sections to replace.');
}
