import React from "react";
import { Prescription, Patient } from "../types";
import { calculateAge } from "../utils";
import { Printer, FileText, X } from "lucide-react";
import QRCode from "qrcode";

const QRCodeComponent = ({ value, size }: { value: string; size: number }) => {
  const [qrSrc, setQrSrc] = React.useState<string>("");

  React.useEffect(() => {
    QRCode.toDataURL(value, { margin: 1, width: size }).then(setQrSrc);
  }, [value, size]);

  if (!qrSrc)
    return (
      <div style={{ width: size, height: size }} className="bg-slate-100 animate-pulse rounded" />
    );
  return <img src={qrSrc} alt="QR de Verificación" width={size} height={size} />;
};

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  docs: Prescription[];
  doctorName: string;
  doctorRut?: string;
  doctorSpecialty?: string;
  doctorInstitution?: string;
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
  doctorRut: propRut,
  doctorSpecialty: propSpecialty,
  doctorInstitution: propInstitution,
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

  const downloadPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const html2canvas = (await import("html2canvas")).default;
    const pdf = new jsPDF("p", "mm", "a5");

    const elements = document.querySelectorAll(".print-document");

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i] as HTMLElement;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");

      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    }

    const filename = `Doc_${selectedPatient.fullName.replace(/\s+/g, "_")}_${new Date().getTime()}.pdf`;
    pdf.save(filename);
  };

  // Fallback values for missing info
  const doctorRut = propRut || "No registrado";
  const doctorSpecialty = propSpecialty || "MEDICINA GENERAL";
  const doctorInstitution = propInstitution || "";

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
              onClick={downloadPDF}
              className="bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg font-bold transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Descargar PDF
            </button>
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
                      <h1 className="text-base font-serif font-bold text-slate-900 tracking-wide uppercase leading-tight">
                        {doctorName}
                      </h1>
                      {doctorRut && (
                        <p className="text-[9px] font-mono font-bold text-slate-500 mt-0.5">
                          RUT: {doctorRut}
                        </p>
                      )}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-[11px] font-serif text-slate-800">
                  <div className="col-span-full border-b border-slate-200 pb-1 mb-1 print:border-slate-300">
                    <span className="font-bold uppercase text-[9px] text-slate-500 mr-2">
                      Paciente:
                    </span>{" "}
                    <span className="text-base font-bold">{selectedPatient.fullName}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[9px] text-slate-500 mr-2">RUT:</span>{" "}
                    <span className="font-mono text-sm">{selectedPatient.rut}</span>
                  </div>
                  <div>
                    <span className="font-bold uppercase text-[9px] text-slate-500 mr-2">
                      Edad:
                    </span>{" "}
                    {calculateAge(selectedPatient.birthDate) ?? "-"} años
                  </div>
                  <div className="col-span-full">
                    <span className="font-bold uppercase text-[9px] text-slate-500 mr-2">
                      Dirección:
                    </span>{" "}
                    {selectedPatient.address || "No registrada"}{" "}
                    {selectedPatient.commune ? `, ${selectedPatient.commune}` : ""}
                  </div>
                </div>
              </div>

              {/* 3. Prescription Body */}
              <div className="flex-1 relative font-serif">
                <span className="text-2xl font-bold font-serif text-slate-900 block mb-3">Rp.</span>
                <div className="text-[12px] leading-snug text-slate-900 whitespace-pre-wrap pl-4 border-l-2 border-slate-100 min-h-[200px] print:border-l-slate-300">
                  {doc.content}
                </div>
              </div>

              {/* 4. Footer (Date & Signature) */}
              <footer className="mt-auto pt-8 flex justify-between items-end print:break-inside-avoid relative">
                <div className="text-[11px] font-serif text-slate-600 flex flex-col gap-2">
                  <div className="flex items-start gap-4">
                    {/* QR Verification */}
                    <div className="bg-white p-1.5 border border-slate-200 rounded-lg shadow-sm">
                      <QRCodeComponent
                        value={
                          doc.signature
                            ? `https://clavesalud.cl/verify/${doc.signature.verificationCode}`
                            : `https://clavesalud.cl/verify/${selectedPatient.id}/${doc.id}`
                        }
                        size={80}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-slate-500 mb-1">
                        <span className="font-bold text-slate-700">Sello de Veracidad:</span>{" "}
                        {doc.signature?.hash || "Documento en validación..."}
                      </p>
                      <p className="text-[10px] text-slate-500 mb-1">
                        <span className="font-bold text-slate-700">Cód. Verificación:</span>{" "}
                        <span className="font-mono text-indigo-600 font-bold">
                          {doc.signature?.verificationCode || "N/A"}
                        </span>
                      </p>
                      <p className="text-[10px] text-slate-500">
                        <span className="font-bold text-slate-700">Fecha de Emisión:</span> {today}
                      </p>
                      <p className="mt-2 text-[9px] text-slate-400 italic leading-tight">
                        Este documento cuenta con firma digital simple y puede ser validado escaneando
                        el código QR o ingresando el código en clavesalud.cl/verify
                      </p>
                    </div>
                  </div>
                </div>

                <div className="text-center relative min-w-[200px]">
                  {/* Signature Line */}
                  <div className="w-full border-t-2 border-slate-800 mb-2"></div>
                  <p className="font-bold text-slate-900 text-[11px] leading-tight mb-0.5">
                    {doctorName}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-tighter">
                    {doctorSpecialty || "Médico Cirujano"}
                  </p>
                  {doctorRut && (
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">RUT: {doctorRut}</p>
                  )}
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
