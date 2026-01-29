import React from "react";
import { Prescription, Patient } from "../types";
import { calculateAge } from "../utils";
import { Printer } from "lucide-react";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docs: Prescription[];
  doctorName: string;
  selectedPatient: Patient | null;

  /**
   * Opcionales para dar identidad al documento.
   * - Si no los pasas, el documento imprime igual (sin logos).
   */
  centerName?: string;
  centerLogoUrl?: string; // URL pública (https) o /assets/...
  claveSaludLogoUrl?: string; // URL pública (https) o /assets/...
  doctorRut?: string; // si lo tienes en el perfil; si no, se oculta
  doctorSpecialty?: string; // ej: "MEDICINA INTERNA"
  doctorInstitution?: string; // ej: "Universidad Católica del Maule"
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  docs,
  doctorName,
  selectedPatient,
  centerName,
  centerLogoUrl,
  claveSaludLogoUrl = "/assets/logo.png",
  doctorRut,
  doctorSpecialty = "MEDICINA INTERNA",
  doctorInstitution = "Universidad Católica del Maule",
}) => {
  if (!isOpen || !selectedPatient || docs.length === 0) return null;

  const today = new Date().toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
              className="bg-white w-full max-w-[21cm] min-h-[27cm] p-8 relative flex flex-col shadow-lg print-document"
              id="print-area"
            >
              {/* Logos row */}
              {(centerLogoUrl || claveSaludLogoUrl) && (
                <div className="flex items-center justify-between mb-3 print:break-inside-avoid">
                  <div className="flex items-center gap-2 min-w-0">
                    {claveSaludLogoUrl ? (
                      <img
                        src={claveSaludLogoUrl}
                        alt="ClaveSalud"
                        className="h-10 w-auto object-contain"
                        onError={(e) => {
                          // Si el asset no existe, evita icono roto.
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}
                    {centerName ? (
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">
                        {centerName}
                      </span>
                    ) : null}
                  </div>

                  {centerLogoUrl ? (
                    <img
                      src={centerLogoUrl}
                      alt={centerName ? `Logo ${centerName}` : "Logo centro"}
                      className="h-10 w-auto object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                </div>
              )}

              {/* Header (Doctor Info) */}
              <header className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start gap-4 print:break-inside-avoid">
                <div className="min-w-0">
                  <h1 className="text-xl font-serif font-bold text-slate-900 tracking-wide uppercase leading-tight">
                    {doctorName}
                  </h1>
                  {doctorRut ? (
                    <p className="text-xs font-mono text-slate-600 mt-1">RUT: {doctorRut}</p>
                  ) : null}

                  <div className="text-xs text-slate-700 font-serif mt-2">
                    <p className="font-bold uppercase tracking-wider text-[10px] text-slate-500 mb-0.5">
                      Especialidad
                    </p>
                    <p className="text-sm font-medium">{doctorSpecialty}</p>
                    <p className="italic text-slate-500 text-xs">{doctorInstitution}</p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="border-2 border-slate-900 px-3 py-1 inline-block rounded">
                    <h2 className="text-sm font-bold font-serif text-slate-900 uppercase">
                      {doc.type}
                    </h2>
                  </div>
                </div>
              </header>

              {/* Patient Info */}
              <div className="mb-6 py-3 px-4 bg-slate-50 border border-slate-200 rounded-lg print:border-slate-300 print:bg-transparent print:break-inside-avoid">
                <div className="grid grid-cols-2 gap-y-1.5 text-xs font-serif text-slate-800">
                  <div className="min-w-0">
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">
                      Paciente:
                    </span>
                    <span className="text-sm truncate inline-block max-w-[220px] align-bottom">
                      {selectedPatient.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">RUT:</span>
                    <span className="font-mono text-xs">{selectedPatient.rut}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">Edad:</span>
                    {(calculateAge(selectedPatient.birthDate) ?? "-")} años
                  </div>
                  <div className="min-w-0">
                    <span className="font-bold uppercase text-[10px] text-slate-500 mr-2">
                      Dirección:
                    </span>
                    <span className="truncate inline-block max-w-[260px] align-bottom">
                      {selectedPatient.address || "No registrada"}
                      {selectedPatient.commune ? `, ${selectedPatient.commune}` : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 relative font-serif">
                <span className="text-2xl font-bold text-slate-900 block mb-3">Rp.</span>
                <div className="text-sm leading-relaxed text-slate-900 whitespace-pre-wrap pl-4 border-l border-slate-100 min-h-[220px] print:border-l-slate-300">
                  {doc.content}
                </div>
              </div>

              {/* Footer */}
              <footer className="mt-auto pt-8 flex justify-between items-end gap-4 print:break-inside-avoid">
                <div className="text-[11px] font-serif text-slate-600">
                  <p>
                    <span className="font-bold">Fecha de Emisión:</span> {today}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    Documento generado electrónicamente.
                  </p>
                </div>

                <div className="text-center relative">
                  <div className="w-44 border-t border-slate-800 mb-2"></div>
                  <p className="font-bold text-slate-900 text-xs">{doctorName}</p>
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
          /* A5 para recetas / órdenes */
          @page {
            size: A5 portrait;
            margin: 10mm;
          }

          body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Oculta la app completa y deja solo el modal "print:block" */
          #root { display: none; }

          .print\\:block {
            display: block !important;
            position: absolute;
            top: 0; left: 0;
            width: 100%;
            z-index: 9999;
          }

          /* Documento: medidas A5 + padding razonable */
          .print-document {
            width: 148mm !important;
            min-height: 210mm !important;
            max-width: none !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important;
            padding: 0 !important; /* margen lo maneja @page */
            page-break-after: always;
            break-after: page;
            overflow: visible !important;
          }

          /* Evita cortes feos */
          .print\\:break-inside-avoid { break-inside: avoid; }
        }
      `}</style>
    </div>
  );
};

export default PrintPreviewModal;
