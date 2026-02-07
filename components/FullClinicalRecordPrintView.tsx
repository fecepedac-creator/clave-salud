import React, { useMemo } from "react";
import { Consultation, MedicalCenter, Patient, Prescription } from "../types";
import { calculateAge } from "../utils";
import { Printer } from "lucide-react";

interface GeneratedByInfo {
  name: string;
  rut?: string;
  role?: string;
}

interface FullClinicalRecordPrintViewProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  center: MedicalCenter | null;
  consultations: Consultation[];
  generatedAt: string;
  generatedBy?: GeneratedByInfo;
}

const formatDateTime = (value?: string) => {
  if (!value) return "No registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No registrado";
  return date.toLocaleString("es-CL");
};

const formatDate = (value?: string) => {
  if (!value) return "No registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No registrado";
  return date.toLocaleDateString("es-CL");
};

const formatList = (items?: string[]) => {
  if (!items || items.length === 0) return "No registrado";
  return items.join(", ");
};

const FullClinicalRecordPrintView: React.FC<FullClinicalRecordPrintViewProps> = ({
  isOpen,
  onClose,
  patient,
  center,
  consultations,
  generatedAt,
  generatedBy,
}) => {
  if (!isOpen) return null;

  const centerName = center?.name ?? "Centro Médico";
  const centerRut = center?.legalInfo?.rut ?? "";
  const age = calculateAge(patient.birthDate);
  const sortedConsultations = useMemo(
    () =>
      [...(consultations || [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [consultations]
  );

  const documents = useMemo<Prescription[]>(() => {
    return sortedConsultations.flatMap((consultation) => consultation.prescriptions || []);
  }, [sortedConsultations]);

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
      <div className="bg-white w-full max-w-[21cm] h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-fadeIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:rounded-none">
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white print:hidden">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Ficha Clínica Completa
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex flex-col items-center print:p-0 print:bg-white print:block print:overflow-visible">
          <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[18mm] relative flex flex-col shadow-lg print-document">
            <header className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start gap-4 print:break-inside-avoid">
              <div className="flex flex-col gap-2">
                <img src="/assets/logo.png" alt="ClaveSalud" className="h-10 w-auto" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900">Ficha Clínica Completa</h1>
                  <p className="text-xs text-slate-500">{centerName}</p>
                  {centerRut ? (
                    <p className="text-xs text-slate-500 font-mono">RUT: {centerRut}</p>
                  ) : null}
                </div>
              </div>
              <div className="text-right flex flex-col items-end gap-2">
                {center?.logoUrl ? (
                  <img
                    src={center.logoUrl}
                    alt={`Logo ${centerName}`}
                    className="h-10 w-auto object-contain"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="text-xs text-slate-500 font-semibold">{centerName}</div>
                )}
                <div className="text-xs text-slate-500">
                  <div>Emitido: {formatDateTime(generatedAt)}</div>
                  <div>Emisor: {generatedBy?.name ?? "No registrado"}</div>
                  {generatedBy?.rut ? <div>RUT: {generatedBy.rut}</div> : null}
                  {generatedBy?.role ? <div>Rol: {generatedBy.role}</div> : null}
                </div>
              </div>
            </header>

            <section className="mb-6 print:break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Datos del Paciente</h2>
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Nombre:</span> {patient.fullName || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">RUT:</span> {patient.rut || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Fecha nacimiento:</span>{" "}
                  {formatDate(patient.birthDate)}
                </div>
                <div>
                  <span className="font-semibold">Edad:</span>{" "}
                  {age !== null ? `${age} años` : "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Sexo:</span> {patient.gender || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Teléfono:</span> {patient.phone || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Email:</span> {patient.email || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Dirección:</span>{" "}
                  {patient.address ? `${patient.address}${patient.commune ? `, ${patient.commune}` : ""}` : "No registrado"}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-700">
                <div>
                  <span className="font-semibold">Antecedentes médicos:</span>{" "}
                  {formatList(patient.medicalHistory)}
                </div>
                <div>
                  <span className="font-semibold">Antecedentes quirúrgicos:</span>{" "}
                  {formatList(patient.surgicalHistory)}
                </div>
                <div>
                  <span className="font-semibold">Alergias:</span>{" "}
                  {patient.allergies?.length
                    ? patient.allergies.map((a) => `${a.substance} (${a.type})`).join(", ")
                    : "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Fármacos en uso:</span>{" "}
                  {patient.medications?.length
                    ? patient.medications
                        .map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` (${m.frequency})` : ""}`)
                        .join(", ")
                    : "No registrado"}
                </div>
              </div>
            </section>

            <section className="mb-6">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Historia Clínica</h2>
              {sortedConsultations.length === 0 ? (
                <p className="text-sm text-slate-500">Sin atenciones registradas.</p>
              ) : (
                <div className="space-y-6">
                  {sortedConsultations.map((c) => (
                    <div key={c.id} className="border border-slate-200 rounded-lg p-4 print:break-inside-avoid">
                      <div className="flex flex-wrap justify-between gap-2 text-sm text-slate-600 mb-2">
                        <span className="font-semibold text-slate-800">
                          {formatDateTime(c.date)}
                        </span>
                        <span>
                          Profesional: {c.professionalName || "No registrado"}
                          {c.professionalRut ? ` | RUT: ${c.professionalRut}` : ""}
                          {c.professionalRole ? ` | Rol: ${c.professionalRole}` : ""}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm text-slate-700">
                        <div>
                          <span className="font-semibold">Motivo:</span>{" "}
                          {c.reason || "No registrado"}
                        </div>
                        <div>
                          <span className="font-semibold">Anamnesis:</span>{" "}
                          {c.anamnesis || "No registrado"}
                        </div>
                        <div>
                          <span className="font-semibold">Examen físico:</span>{" "}
                          {c.physicalExam || "No registrado"}
                        </div>
                        <div>
                          <span className="font-semibold">Diagnóstico:</span>{" "}
                          {c.diagnosis || "No registrado"}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <span className="font-semibold">PA:</span>{" "}
                            {c.bloodPressure || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">HGT:</span>{" "}
                            {c.hgt || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">Peso:</span>{" "}
                            {c.weight || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">Talla:</span>{" "}
                            {c.height || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">IMC:</span>{" "}
                            {c.bmi || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">Cintura/Cadera:</span>{" "}
                            {c.waist || "No registrado"} / {c.hip || "No registrado"}
                          </div>
                        </div>
                        {c.exams && Object.keys(c.exams).length > 0 ? (
                          <div>
                            <span className="font-semibold">Exámenes:</span>{" "}
                            {Object.entries(c.exams)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(", ")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="mb-10 print:break-inside-avoid">
              <h2 className="text-lg font-bold text-slate-800 mb-3">Documentos Emitidos</h2>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-500">No hay documentos emitidos.</p>
              ) : (
                <div className="space-y-3 text-sm text-slate-700">
                  {documents.map((doc) => (
                    <div key={doc.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="font-semibold">{doc.type}</div>
                      <div className="whitespace-pre-wrap">{doc.content || "No registrado"}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <footer className="mt-auto pt-6 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
              <span>Documento generado desde ClaveSalud.</span>
              <span className="page-counter"></span>
            </footer>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 18mm;
          }

          html, body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            height: auto !important;
          }

          body * {
            visibility: hidden;
          }

          .print\\:block {
            display: block !important;
            position: absolute;
            inset: 0;
            z-index: 9999;
            visibility: visible;
          }

          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }

          .print-document {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 10.5pt;
            line-height: 1.35;
            height: auto !important;
            min-height: auto !important;
            position: relative !important;
            overflow: visible !important;
          }

          .page-counter::after {
            content: "Página " counter(page) " de " counter(pages);
          }
        }
      `}</style>
    </div>
  );
};

export default FullClinicalRecordPrintView;
