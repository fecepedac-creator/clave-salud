import React from "react";
import { createPortal } from "react-dom";
import { Prescription, Patient } from "../types";
import { calculateAge } from "../utils";
import { Printer, FileText, X } from "lucide-react";
import QRCode from "qrcode";
import { logAuditEventRequired } from "../hooks/useAuditLog";
import { useToast } from "./Toast";

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
  doctorProfession?: string;
  doctorSpecialty?: string;
  centerName?: string;
  centerLogoUrl?: string;
  centerAddress?: string;
  centerPhone?: string;
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
  doctorProfession,
  doctorSpecialty: propSpecialty,
  centerName,
  centerLogoUrl,
  centerAddress,
  centerPhone,
  selectedPatient,
}) => {
  const { showToast } = useToast();
  if (!isOpen || !selectedPatient || docs.length === 0) return null;

  const formatIssueDate = (value?: string) => {
    const parsed = value ? new Date(value) : new Date();
    const safeDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    return safeDate.toLocaleDateString("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const origin =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
      ? window.location.origin
      : "https://clavesalud-2.web.app";

  const downloadPDF = async () => {
    try {
      await logAuditEventRequired({
        centerId: selectedPatient.centerId || selectedPatient.accessControl?.centerIds?.[0] || "",
        action: "CLINICAL_DOCUMENT_DOWNLOAD",
        entityType: "prescription",
        entityId: docs.map((doc) => doc.id).join(","),
        patientId: selectedPatient.id,
        details: "Descarga PDF de receta/documento clinico.",
        metadata: { documentCount: docs.length, documentTypes: docs.map((doc) => doc.type) },
      });
    } catch {
      showToast("La descarga no se realizó porque no pudo registrarse la auditoría.", "error");
      return;
    }
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

  // Mostrar solo datos ya registrados; un documento clínico no debe inventar
  // valores para completar antecedentes legales faltantes.
  const doctorRut = propRut?.trim();
  const doctorSpecialty = propSpecialty?.trim();

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/80 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block clavesalud-print-view">
      <div className="bg-white w-full max-w-[21cm] h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-fadeIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:rounded-none clavesalud-print-box">
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
              onClick={async () => {
                try {
                  await logAuditEventRequired({
                    centerId:
                      selectedPatient.centerId ||
                      selectedPatient.accessControl?.centerIds?.[0] ||
                      "",
                    action: "CLINICAL_DOCUMENT_PRINT",
                    entityType: "prescription",
                    entityId: docs.map((doc) => doc.id).join(","),
                    patientId: selectedPatient.id,
                    details: "Impresion de receta/documento clinico.",
                    metadata: {
                      documentCount: docs.length,
                      documentTypes: docs.map((doc) => doc.type),
                    },
                  });
                  window.print();
                } catch {
                  showToast(
                    "La impresión no se realizó porque no pudo registrarse la auditoría.",
                    "error"
                  );
                }
              }}
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
        <div className="flex-1 overflow-auto bg-slate-100 p-6 flex flex-col items-center gap-6 print:p-0 print:bg-white print:block print:overflow-visible clavesalud-print-content">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="bg-white w-full max-w-[148mm] min-h-[210mm] p-8 relative flex flex-col shadow-lg print-document"
              id="print-area"
            >
              {/* 1. Encabezado institucional: centro y profesional en columnas separadas */}
              <header className="grid grid-cols-2 gap-8 border-b-2 border-slate-900 pb-5 mb-6 print:break-inside-avoid">
                <section
                  className="flex items-start gap-3 min-w-0"
                  aria-label="Datos del centro médico"
                >
                  <img
                    src={centerLogoUrl || "/assets/logo.png"}
                    alt={centerName ? `Logo ${centerName}` : "ClaveSalud"}
                    width="48"
                    height="48"
                    className="h-10 w-10 shrink-0 object-contain"
                    style={{ objectFit: "contain" }}
                    loading="lazy"
                    onError={(event) => {
                      if (!event.currentTarget.src.endsWith("/assets/logo.png")) {
                        event.currentTarget.src = "/assets/logo.png";
                      }
                    }}
                  />
                  <div className="min-w-0 font-sans text-[10px] leading-relaxed text-slate-600">
                    <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Centro médico
                    </p>
                    <h1 className="text-[14px] font-bold leading-tight text-slate-900">
                      {centerName || "ClaveSalud"}
                    </h1>
                    {centerAddress && <p className="mt-1">{centerAddress}</p>}
                    {centerPhone && <p>{centerPhone}</p>}
                  </div>
                </section>

                <section
                  className="min-w-0 text-right font-sans"
                  aria-label="Datos del profesional"
                >
                  <div className="mb-3 inline-block rounded-md border-2 border-slate-900 px-3 py-1">
                    <h2 className="text-[12px] font-bold uppercase tracking-wide text-slate-900">
                      {doc.type}
                    </h2>
                  </div>
                  <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Profesional tratante
                  </p>
                  <h3 className="text-[14px] font-bold leading-tight text-slate-900">
                    {doctorName}
                  </h3>
                  <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
                    {doctorProfession && <p>{doctorProfession}</p>}
                    {doctorSpecialty && <p>Especialidad: {doctorSpecialty}</p>}
                    {doctorRut && <p className="font-mono">RUT: {doctorRut}</p>}
                  </div>
                </section>
              </header>

              {/* 2. Patient Info (Required by Law) */}
              <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4 font-sans print:break-inside-avoid print:border-slate-300 print:bg-transparent">
                <p className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  Paciente
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[10px] text-slate-700">
                  <div className="col-span-2 mb-1 border-b border-slate-200 pb-2 print:border-slate-300">
                    <span className="text-[15px] font-bold text-slate-900">
                      {selectedPatient.fullName}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold">RUT:</span>{" "}
                    <span className="font-mono">{selectedPatient.rut}</span>
                  </div>
                  <div>
                    <span className="font-bold">Edad:</span>{" "}
                    {calculateAge(selectedPatient.birthDate) ?? "-"} años
                  </div>
                  {selectedPatient.address && (
                    <div>
                      <span className="font-bold">Dirección:</span> {selectedPatient.address}
                    </div>
                  )}
                  {selectedPatient.commune && (
                    <div>
                      <span className="font-bold">Comuna:</span> {selectedPatient.commune}
                    </div>
                  )}
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
                  <div className="flex items-start gap-3">
                    {/* QR Verification */}
                    <div className="bg-white p-1 border border-slate-200 rounded">
                      <QRCodeComponent
                        value={
                          doc.signature
                            ? `${origin}/v/${doc.signature.hash}`
                            : `${origin}/verify/${selectedPatient.id}/${doc.id}`
                        }
                        size={64}
                      />
                    </div>
                    <div className="flex-1">
                      <p>
                        <span className="font-bold">Fecha de Emisión:</span>{" "}
                        {formatIssueDate(doc.createdAt)}
                      </p>
                      <p className="mt-0.5 text-[10px] text-slate-400">
                        ID: <span className="font-mono">{doc.id}</span>
                      </p>
                      <p className="mt-1 text-[9px] text-slate-500 leading-tight">
                        Escanee el QR para validar la
                        <br />
                        autenticidad de este documento.
                      </p>
                      {doc.signature && (
                        <div className="mt-2 pt-2 border-t border-slate-100 text-[7px] font-mono text-slate-400 max-w-[150px]">
                          <p className="truncate">HASH: {doc.signature.hash}</p>
                          <p>VERIFICACIÓN: {doc.signature.verificationCode}</p>
                        </div>
                      )}
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
                    {[doctorProfession, doctorSpecialty].filter(Boolean).join(" · ")}
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

          /* Ocultar el root de la app y otros portales para evitar páginas en blanco */
          body > *:not(.clavesalud-print-view) {
            display: none !important;
          }

          .clavesalud-print-view {
            display: block !important;
            position: static !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            overflow: visible !important;
          }

          .clavesalud-print-box {
            display: block !important;
            position: static !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            background: white !important;
            overflow: visible !important;
          }

          .clavesalud-print-content {
            display: block !important;
            position: static !important;
            height: auto !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            background: white !important;
          }

          /* Mantener dimensiones físicas A5 reales para evitar estiramientos en A4/Carta */
          .print-document {
            width: 148mm !important;
            height: 210mm !important;
            max-width: 148mm !important;
            min-height: 210mm !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            margin: 0 auto !important; /* Centrado en caso de imprimir en A4 */
            padding: 10mm !important;
            font-size: 10.5pt;
            line-height: 1.3;
            box-sizing: border-box !important;
            position: relative !important;
            overflow: visible !important;
          }

          /* Forzar salto de página entre documentos, pero no al final */
          .print-document:not(:last-child) {
            page-break-after: always !important;
            break-after: page !important;
          }

          .print\\:break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>,
    document.body
  );
};

export default PrintPreviewModal;
