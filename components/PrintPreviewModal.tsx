
import React from 'react';
import { Prescription, Patient } from '../types';
import { calculateAge } from '../utils';
import { Printer } from 'lucide-react';

interface PrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    docs: Prescription[];
    doctorName: string;
    selectedPatient: Patient | null;
}

const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ isOpen, onClose, docs, doctorName, selectedPatient }) => {
    if (!isOpen || !selectedPatient || docs.length === 0) return null;

    const today = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });

    return (
        <div className="fixed inset-0 bg-slate-900/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
            <div className="bg-white w-full max-w-[21cm] h-[90vh] flex flex-col rounded-xl shadow-2xl overflow-hidden animate-fadeIn print:shadow-none print:h-auto print:w-full print:overflow-visible print:rounded-none">
                
                {/* Toolbar (Hidden in Print) */}
                <div className="bg-slate-800 p-4 flex justify-between items-center text-white print:hidden">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Printer className="w-5 h-5"/> 
                        Vista Previa ({docs.length} documento{docs.length > 1 ? 's' : ''})
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-bold transition-colors">Imprimir</button>
                        <button onClick={onClose} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg font-bold transition-colors">Cerrar</button>
                    </div>
                </div>

                {/* Printable Area (Iterate over documents) */}
                <div className="flex-1 overflow-auto bg-slate-100 p-8 flex flex-col items-center gap-8 print:p-0 print:bg-white print:block print:overflow-visible">
                    {docs.map((doc) => (
                        <div key={doc.id} className="bg-white w-full max-w-[21cm] min-h-[27cm] p-12 relative flex flex-col shadow-lg print-document" id="print-area">
                            
                            {/* 1. Header (Doctor Info) */}
                            <header className="border-b-[3px] border-slate-900 pb-6 mb-8 flex justify-between items-start print:break-inside-avoid">
                                <div>
                                    <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-wide uppercase">{doctorName}</h1>
                                    <div className="text-sm text-slate-700 font-serif mt-1">
                                        <p className="font-bold uppercase tracking-wider text-xs mb-0.5">Especialidad</p>
                                        <p className="text-lg">MEDICINA INTERNA</p>
                                        <p className="italic text-slate-500">Universidad Católica del Maule</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-mono font-bold text-slate-600">RUT: 16.459.999-1</p>
                                    <div className="border-2 border-slate-900 px-4 py-1 mt-2 inline-block rounded">
                                        <h2 className="text-lg font-bold font-serif text-slate-900 uppercase">{doc.type}</h2>
                                    </div>
                                </div>
                            </header>

                            {/* 2. Patient Info (Required by Law) */}
                            <div className="mb-10 py-4 px-6 bg-slate-50 border border-slate-200 rounded-lg print:border-slate-300 print:bg-transparent print:break-inside-avoid">
                                <div className="grid grid-cols-2 gap-y-2 text-sm font-serif text-slate-800">
                                    <div><span className="font-bold uppercase text-xs text-slate-500 mr-2">Paciente:</span> <span className="text-lg">{selectedPatient.fullName}</span></div>
                                    <div><span className="font-bold uppercase text-xs text-slate-500 mr-2">RUT:</span> <span className="font-mono text-base">{selectedPatient.rut}</span></div>
                                    <div><span className="font-bold uppercase text-xs text-slate-500 mr-2">Edad:</span> {calculateAge(selectedPatient.birthDate)} años</div>
                                    <div><span className="font-bold uppercase text-xs text-slate-500 mr-2">Dirección:</span> {selectedPatient.address || 'No registrada'} {selectedPatient.commune ? `, ${selectedPatient.commune}` : ''}</div>
                                </div>
                            </div>

                            {/* 3. Prescription Body */}
                            <div className="flex-1 relative font-serif">
                                <span className="text-4xl font-bold font-serif text-slate-900 block mb-6">Rp.</span>
                                <div className="text-xl leading-relaxed text-slate-900 whitespace-pre-wrap pl-8 border-l-2 border-slate-100 min-h-[300px] print:border-l-slate-300">
                                    {doc.content}
                                </div>
                            </div>

                            {/* 4. Footer (Date & Signature) */}
                            <footer className="mt-auto pt-16 flex justify-between items-end print:break-inside-avoid">
                                <div className="text-sm font-serif text-slate-600">
                                    <p><span className="font-bold">Fecha de Emisión:</span> {today}</p>
                                    <p className="mt-1 text-xs text-slate-400">Documento generado electrónicamente.</p>
                                </div>
                                <div className="text-center relative">
                                    {/* Signature Line */}
                                    <div className="w-64 border-t-2 border-slate-800 mb-2"></div>
                                    <p className="font-bold text-slate-900 text-sm">{doctorName}</p>
                                    <p className="text-xs text-slate-500 uppercase">Médico Cirujano</p>
                                    <p className="text-xs text-slate-500 font-mono">16.459.999-1</p>
                                </div>
                            </footer>

                        </div>
                    ))}
                </div>
            </div>
            <style>{`
                @media print {
                    @page { 
                        size: letter; 
                        margin: 0; 
                    }
                    body { 
                        background: white; 
                        -webkit-print-color-adjust: exact;
                    }
                    #root { display: none; }
                    .print\\:block { display: block !important; position: absolute; top: 0; left: 0; width: 100%; z-index: 9999; }
                    
                    /* Robust Document Styling for Print */
                    .print-document {
                        width: 100% !important;
                        height: 100vh !important;
                        max-width: none !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        margin: 0 !important;
                        padding: 2.5cm !important; /* Standard print margin */
                        page-break-after: always;
                        break-after: page;
                        position: relative !important;
                        overflow: hidden !important;
                    }
                    
                    /* Prevent breaking inside critical elements */
                    .print\\:break-inside-avoid {
                        break-inside: avoid;
                    }
                }
            `}</style>
        </div>
    );
};

export default PrintPreviewModal;