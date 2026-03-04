const fs = require('fs');
let code = fs.readFileSync('components/DoctorDashboard.tsx', 'utf-8');

// 1. Añadir importaciones (después del último sub-componente importado)
const importStr = `import { DoctorPatientsListTab } from "../features/doctor/components/DoctorPatientsListTab";
import { DoctorAgendaTab } from "../features/doctor/components/DoctorAgendaTab";
import { DoctorSettingsTab } from "../features/doctor/components/DoctorSettingsTab";\n`;

code = code.replace(
    'import DrivePicker from "./DrivePicker";',
    'import DrivePicker from "./DrivePicker";\n' + importStr
);

// 2. Extraer y reemplazar la pestaña de pacientes
const patientsPattern = /\{\/\* CONTENT: PATIENTS LIST \*\/}.*?(?=\{\/\* CONTENT: AGENDA VIEW \*\/})/gs;
const patientsReplacement = `
            {/* CONTENT: PATIENTS LIST */}
            {activeTab === "patients" && (
              <DoctorPatientsListTab
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                filteredPatients={filteredPatients}
                handleSelectPatient={handleSelectPatient}
                onSetPortfolioMode={onSetPortfolioMode}
                portfolioMode={portfolioMode}
                setFilterNextControl={setFilterNextControl}
                filterNextControl={filterNextControl}
                isReadOnly={isReadOnly}
                hasActiveCenter={hasActiveCenter}
                activeCenterId={activeCenterId}
                currentUser={currentUser}
                setSelectedPatient={setSelectedPatient}
                setIsEditingPatient={setIsEditingPatient}
                getActiveConsultations={getActiveConsultations}
                getNextControlDateFromPatient={getNextControlDateFromPatient}
                setWhatsAppMenuForPatientId={setWhatsAppMenuForPatientId}
                whatsAppMenuForPatientId={whatsAppMenuForPatientId}
                whatsAppTemplates={whatsAppTemplates}
                openWhatsApp={openWhatsApp}
              />
            )}
            `;
code = code.replace(patientsPattern, patientsReplacement);

// 3. Extraer y reemplazar la pestaña de agenda
const agendaPattern = /\{\/\* CONTENT: AGENDA VIEW \*\/}.*?(?=\{\/\* CONTENT: SETTINGS \(TEMPLATES & PROFILES\) \*\/})/gs;
const agendaReplacement = `
            {/* CONTENT: AGENDA VIEW */}
            {activeTab === "agenda" && moduleGuards.agenda && (
              <DoctorAgendaTab
                isAdministrativo={isAdministrativo}
                clinicalDoctors={clinicalDoctors}
                viewingDoctorId={viewingDoctorId}
                setViewingDoctorId={setViewingDoctorId}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                selectedAgendaDate={selectedAgendaDate}
                setSelectedAgendaDate={setSelectedAgendaDate}
                appointments={appointments}
                effectiveDoctorId={effectiveDoctorId}
                effectiveAgendaConfig={effectiveAgendaConfig}
                isSyncingAppointments={isSyncingAppointments}
                isReadOnly={isReadOnly}
                hasActiveCenter={hasActiveCenter}
                currentUser={currentUser}
                activeCenterId={activeCenterId}
                onUpdateAppointments={onUpdateAppointments}
                setSlotModal={setSlotModal}
                handleOpenPatientFromAppointment={handleOpenPatientFromAppointment}
              />
            )}
            `;
code = code.replace(agendaPattern, agendaReplacement);

// 4. Extraer y reemplazar la pestaña de configuración
const settingsPattern = /\{\/\* CONTENT: SETTINGS \(TEMPLATES & PROFILES\) \*\/}.*?(?=\{\/\* Slot Modal \(For Agenda\) \*\/})/gs;
const settingsReplacement = `
            {/* CONTENT: SETTINGS (TEMPLATES & PROFILES) */}
            {activeTab === "settings" && (
              <DoctorSettingsTab
                currentUser={currentUser}
                doctorId={doctorId}
                role={role}
                moduleGuards={moduleGuards}
                isReadOnly={isReadOnly}
                onUpdateDoctor={onUpdateDoctor}
                onLogActivity={onLogActivity}
                myExamProfiles={myExamProfiles}
                setMyExamProfiles={setMyExamProfiles}
                tempProfile={tempProfile}
                setTempProfile={setTempProfile}
                isEditingProfileId={isEditingProfileId}
                setIsEditingProfileId={setIsEditingProfileId}
                allExamOptions={allExamOptions}
                newCustomExam={newCustomExam}
                setNewCustomExam={setNewCustomExam}
                myTemplates={myTemplates}
                setMyTemplates={setMyTemplates}
                tempTemplate={tempTemplate}
                setTempTemplate={setTempTemplate}
                isEditingTemplateId={isEditingTemplateId}
                setIsEditingTemplateId={setIsEditingTemplateId}
                isCatalogOpen={isCatalogOpen}
                setIsCatalogOpen={setIsCatalogOpen}
                catalogSearch={catalogSearch}
                setCatalogSearch={setCatalogSearch}
                pwdState={pwdState}
                setPwdState={setPwdState}
              />
            )}
            `;
code = code.replace(settingsPattern, settingsReplacement);

fs.writeFileSync('components/DoctorDashboard.tsx', code);
console.log('Reemplazo completo de modulos realizado!');
