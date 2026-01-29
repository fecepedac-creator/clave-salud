import React from "react";
import { Prescription, Patient } from "../types";
import { calculateAge } from "../utils";
import { Printer } from "lucide-react";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docs: Prescription[];
  doctorName: string;
  centerName?: string;
  centerLogoUrl?: string;
  selectedPatient: Patient | null;
}

/**
 * NOTE:
 * - El tamaño de impresión se controla vía @page.
 * - Esta vista está optimizada para documentos "pequeños" (A5).
 * - Para que el diálogo de impresión NO quede en blanco, NO debemos ocultar #root,
 *   porque este modal vive dentro de #root.
 */
const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  docs,
  doctorName,
  centerName,
  centerLogoUrl,
  selectedPatient,
}) => {
  if (!isOpen || !selectedPatient || docs.length === 0) return null;

  const today = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // TODO (mejora futura): hacer que estos datos vengan desde el perfil del profesional/centro
  const doctorRut = "16.459.999-1";
  const doctorSpecialty = "MEDICINA INTERNA";
  const doctorInstitution = "Universidad Católica del Maule";

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
      <div className="bg-white w-full max-w-[21cm] h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-fadeIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:rounded-none">
        {/* Toolbar (Hidden in Print) */}
        <div className="bg-slate-800 p-4 flex justify-between items-center text-white print:hidden">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Printer className="w-5 h-5" />
            Vista Previa ({docs.length} documento{docs.length > 1 ? "s" : ""})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* Printable Area (Iterate over documents) */}
        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex flex-col items-center gap-6 print:p-0 print:bg-white print:block print:overflow-visible">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white w-full max-w-[148mm] min-h-[210mm] p-8 relative flex flex-col shadow-lg print-document"
              id="print-area"
            >
              {/* 1. Header (Doctor Info) */}
              <header className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start gap-4 print:break-inside-avoid">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <img
                      src="/assets/logo.png"
                      alt="ClaveSalud"
                      className="h-8 w-auto object-contain"
                    />
                    <div>
                      <h1 className="text-lg font-serif font-bold text-slate-900 tracking-wide uppercase">
                        {doctorName}
                      </h1>
                      {doctorRut ? (
                        <p className="text-[10px] font-mono font-bold text-slate-600 mt-0.5">
                          RUT: {doctorRut}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-700 font-serif mt-3">
                    <p className="font-bold uppercase tracking-wider text-[10px] mb-0.5">
                      Especialidad
                    </p>
                    <p className="text-base">{doctorSpecialty}</p>
                    <p className="italic text-slate-500">{doctorInstitution}</p>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end gap-2">
                  {centerLogoUrl ? (
                    <img
                      src={centerLogoUrl}
                      alt={centerName ? `Logo ${centerName}` : "Logo centro"}
                      className="h-8 w-auto object-contain"
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : null}
                  <div className="border-2 border-slate-900 px-3 py-1 inline-block rounded">
                    <h2 className="text-sm font-bold font-serif text-slate-900 uppercase">
                      {doc.type}
                    </h2>
                  </div>
                </div>
              </header>

              {/* 2. Patient Info (Required by Law) */}
              <div className="mb-6 py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg print:border-slate-300 print:bg-transparent print:break-inside-avoid">
                <div className="grid grid-cols-2 gap-y-2 text-[11px] font-serif text-slate-800">
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">
                      Paciente:
                    </span>{" "}
                    <span className="text-base">{selectedPatient.fullName}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">
                      RUT:
                    </span>{" "}
                    <span className="font-mono text-sm">{selectedPatient.rut}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">
                      Edad:
                    </span>{" "}
                    {(calculateAge(selectedPatient.birthDate) ?? "-")} años
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">
                      Dirección:
                    </span>{" "}
                    {selectedPatient.address || "No registrada"}{" "}
                    {selectedPatient.commune ? `, ${selectedPatient.commune}` : ""}
                  </div>
                </div>
              </div>

              {/* 3. Prescription Body */}
              <div className="flex-1 relative font-serif">
                <span className="text-2xl font-bold font-serif text-slate-900 block mb-3">
                  Rp.
                </span>
                <div className="text-[12px] leading-snug text-slate-900 whitespace-pre-wrap pl-4 border-l-2 border-slate-100 min-h-[200px] print:border-l-slate-300">
                  {doc.content}
                </div>
              </div>

              {/* 4. Footer (Date & Signature) */}
              <footer className="mt-auto pt-8 flex justify-between items-end print:break-inside-avoid">
                <div className="text-[11px] font-serif text-slate-600">
                  <p>
                    <span className="font-bold">Fecha de Emisión:</span> {today}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Documento generado electrónicamente.
                  </p>
                </div>
                <div className="text-center relative">
                  {/* Signature Line */}
                  <div className="w-56 border-t-2 border-slate-800 mb-2"></div>
                  <p className="font-bold text-slate-900 text-[11px]">{doctorName}</p>
                  <p className="text-[10px] text-slate-500 uppercase">Médico Cirujano</p>
                  {doctorRut ? (
                    <p className="text-[10px] text-slate-500 font-mono">{doctorRut}</p>
                  ) : null}
                </div>
              </footer>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media print {
          /* A5 para documentos clínicos "pequeños" */
          @page { 
            size: A5 portrait; 
            margin: 9mm; 
          }

          html, body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            height: auto !important;
          }

          /* Importante: NO ocultar #root, porque este modal vive dentro de #root.
             Si lo ocultas, la vista previa de impresión queda en blanco. */
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

          /* Documento: márgenes internos adecuados para A5 */
          .print-document {
            width: 100% !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 !important;

            /* Para A5, 10–12mm suele verse mejor que 2.5cm */
            padding: 10mm !important;
            font-size: 10.5pt;
            line-height: 1.3;

            /* Evitar forzar 100vh (a veces rompe el preview) */
            height: auto !important;
            min-height: auto !important;

            page-break-after: always;
            break-after: page;
            position: relative !important;
            overflow: visible !important;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
};

export default PrintPreviewModal;
