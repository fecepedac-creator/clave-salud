import React, { useMemo } from "react";
import { createPortal } from "react-dom";
import { Consultation, MedicalCenter, Patient, Prescription, SnomedConcept } from "../types";
import { calculateAge, openEmailCompose } from "../utils";
import { Printer, Mail, X } from "lucide-react";

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

const formatList = (items?: Array<string | SnomedConcept>) => {
  if (!items || items.length === 0) return "No registrado";
  return items
    .map((item) => (typeof item === "string" ? item : item.display))
    .join(", ");
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

  // Las recetas se renderizan directamente debajo de cada consulta

  const handleSendEmail = () => {
    if (!patient) return;

    const subject = `Ficha Clínica Completa - ${patient.fullName}`;
    const lines: string[] = [];

    lines.push(`FICHA CLÍNICA COMPLETA`);
    lines.push(`Centro Médico: ${centerName}`);
    if (centerRut) lines.push(`RUT Centro: ${centerRut}`);
    lines.push(`Fecha de Emisión: ${formatDateTime(generatedAt)}`);
    lines.push(`Emisor: ${generatedBy?.name ?? "No registrado"}`);
    lines.push(`==========================================`);
    lines.push(`DATOS DEL PACIENTE`);
    lines.push(`Nombre: ${patient.fullName || "No registrado"}`);
    lines.push(`RUT: ${patient.rut || "No registrado"}`);
    lines.push(`Fecha de nacimiento: ${formatDate(patient.birthDate)} (${age !== null ? `${age} años` : "No registrado"})`);
    lines.push(`Sexo: ${patient.gender || "No registrado"}`);
    lines.push(`Teléfono: ${patient.phone || "No registrado"}`);
    lines.push(`Email: ${patient.email || "No registrado"}`);
    lines.push(`Dirección: ${patient.address || "No registrado"}`);
    lines.push(`Antecedentes Médicos: ${formatList(patient.medicalHistory)}`);
    lines.push(`Antecedentes Quirúrgicos: ${formatList(patient.surgicalHistory)}`);
    lines.push(`Alergias: ${patient.allergies?.length ? patient.allergies.map((a) => `${a.substance} (${a.type})`).join(", ") : "No registrado"}`);
    lines.push(`Fármacos en uso: ${patient.medications?.length ? patient.medications.map((m) => `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` (${m.frequency})` : ""}`).join(", ") : "No registrado"}`);
    lines.push(`==========================================`);
    lines.push(`HISTORIAL CLÍNICO`);

    if (sortedConsultations.length === 0) {
      lines.push("Sin atenciones registradas.");
    } else {
      sortedConsultations.forEach((c) => {
        lines.push(`------------------------------------------`);
        lines.push(`Fecha: ${formatDateTime(c.date)}`);
        lines.push(`Profesional: ${c.professionalName || "No registrado"}`);
        lines.push(`Motivo: ${c.reason || "No registrado"}`);
        lines.push(`Anamnesis: ${c.anamnesis || "No registrado"}`);
        lines.push(`Diagnóstico: ${c.diagnosis || "No registrado"}`);
        if (c.bloodPressure || c.weight || c.height) {
          lines.push(`Signos: PA: ${c.bloodPressure || "-"} | HGT: ${c.hgt || "-"} | Peso: ${c.weight || "-"} kg | Talla: ${c.height || "-"} cm`);
        }
      });
    }

    openEmailCompose({
      to: patient.email || "",
      subject,
      body: lines.join("\n"),
    });
  };

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
      <div className="bg-white w-full max-w-[21cm] h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-fadeIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:rounded-none">
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white print:hidden">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-400" />
            Ficha Clínica Completa
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
            >
              <Printer className="w-4 h-4" />
              Imprimir / Guardar PDF
            </button>
            <button
              onClick={handleSendEmail}
              className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm shadow-md active:scale-95"
            >
              <Mail className="w-4 h-4" />
              Enviar por Email
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold transition-all flex items-center gap-2 text-sm active:scale-95"
            >
              <X className="w-4 h-4" />
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex flex-col items-center print:p-0 print:bg-white print:block print:overflow-visible">
          <div className="bg-white w-full max-w-[210mm] min-h-[297mm] p-[18mm] relative flex flex-col shadow-lg print-document">
            <table className="w-full border-collapse">
              <thead>
                <tr className="hidden print:table-row">
                  <td className="p-0 border-0">
                    {/* Running Header for print (Opción B) */}
                    <div className="print-running-header">
                      <img src="/assets/logo.png" alt="ClaveSalud" width="90" height="22" className="h-5 w-auto object-contain" style={{ objectFit: "contain" }} />
                      <span className="text-[9px] text-slate-500 font-medium">
                        Ficha Clínica Completa - {patient.fullName}
                      </span>
                      {center?.logoUrl ? (
                        <img
                          src={center.logoUrl}
                          alt={`Logo ${centerName}`}
                          width="90"
                          height="22"
                          className="h-5 w-auto object-contain"
                          style={{ objectFit: "contain" }}
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-[9px] text-slate-500 font-bold">{centerName}</span>
                      )}
                    </div>
                  </td>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-0 border-0">
                    <header className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start gap-4 print:break-inside-avoid">
              <div className="flex flex-col gap-2">
                <img src="/assets/logo.png" alt="ClaveSalud" width="160" height="40" className="h-10 w-auto object-contain max-w-[160px]" style={{ objectFit: "contain" }} />
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
                  <span className="font-semibold">Nombre:</span>{" "}
                  {patient.fullName || "No registrado"}
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
                  <span className="font-semibold">Teléfono:</span>{" "}
                  {patient.phone || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Email:</span> {patient.email || "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Dirección:</span>{" "}
                  {patient.address
                    ? `${patient.address}${patient.commune ? `, ${patient.commune}` : ""}`
                    : "No registrado"}
                </div>
                <div>
                  <span className="font-semibold">Identidad de Género:</span>{" "}
                  {patient.genderIdentity || "No declarada"}
                </div>
                <div>
                  <span className="font-semibold">Previsión:</span>{" "}
                  {patient.insurance || "No registrada"}
                  {patient.insurance === "FONASA" &&
                    patient.insuranceLevel &&
                    ` (${patient.insuranceLevel})`}
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
                        .map(
                          (m) =>
                            `${m.name}${m.dose ? ` ${m.dose}` : ""}${m.frequency ? ` (${m.frequency})` : ""}`
                        )
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
                    <div
                      key={c.id}
                      className="border border-slate-200 rounded-lg p-4 print:break-inside-avoid"
                    >
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
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100">
                          <div>
                            <span className="font-semibold">PA:</span>{" "}
                            {c.bloodPressure || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">HGT:</span> {c.hgt || "No registrado"}
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
                            <span className="font-semibold">IMC:</span> {c.bmi || "No registrado"}
                          </div>
                          <div>
                            <span className="font-semibold">Cintura/Cadera:</span>{" "}
                            {c.waist || "No registrado"} / {c.hip || "No registrado"}
                          </div>
                        </div>
                        <div className="mt-2">
                          <span className="font-semibold">Examen físico:</span>{" "}
                          {c.physicalExam || "No registrado"}
                        </div>
                        <div>
                          <span className="font-semibold">Diagnóstico:</span>{" "}
                          {c.diagnosis || "No registrado"}
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

                      {c.prescriptions && c.prescriptions.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-dashed border-slate-200 print:break-inside-avoid">
                          <span className="font-bold text-slate-800 text-xs uppercase tracking-wider block mb-2">
                            Documentos / Recetas Emitidas en esta Consulta:
                          </span>
                          <div className="space-y-2">
                            {c.prescriptions.map((p) => (
                              <div key={p.id} className="bg-slate-50 border border-slate-200/60 rounded-lg p-3 text-xs">
                                <div className="font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-[10px]">
                                    {p.type || "Receta"}
                                  </span>
                                </div>
                                <div className="whitespace-pre-wrap text-slate-700 font-mono leading-relaxed bg-white border border-slate-100 p-2.5 rounded shadow-sm">
                                  {p.content || "Sin contenido registrado"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
            {/* Las recetas y certificados se muestran directamente bajo cada atención para mayor claridad */}

            <footer className="mt-auto pt-6 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
              <span>Documento generado desde ClaveSalud.</span>
              <span className="page-counter"></span>
            </footer>
                  </td>
                </tr>
              </tbody>
            </table>
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

          .print-running-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            border-bottom: 1px solid #cbd5e1 !important;
            padding-bottom: 2mm !important;
            margin-bottom: 4mm !important;
            width: 100% !important;
            visibility: visible !important;
          }

          .print-running-header * {
            visibility: visible !important;
          }

          .page-counter::after {
            content: "Página " counter(page) " de " counter(pages);
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default FullClinicalRecordPrintView;
