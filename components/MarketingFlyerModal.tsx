import React, { useState, useEffect, useRef } from 'react';
import {
    X,
    Download,
    Copy,
    Check,
    Image as ImageIcon,
    Loader,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import FlyerCanvas from './FlyerCanvas';
import {
    FlyerFormat,
    FlyerType,
    generateQRCode,
    generateCaption,
    generateBookingURL,
    getAvailableSlots,
    extractSpecialties,
} from '../utils/flyerGenerator';
import { MedicalCenter, Doctor, Appointment } from '../types';
import { useToast } from './Toast';

interface MarketingFlyerModalProps {
    type: FlyerType;
    center?: MedicalCenter;
    doctors?: Doctor[];
    appointments?: Appointment[];
    onClose: () => void;
    onStatsUpdate?: (type: FlyerType) => void;
}

const MarketingFlyerModal: React.FC<MarketingFlyerModalProps> = ({
    type,
    center,
    doctors = [],
    appointments = [],
    onClose,
    onStatsUpdate,
}) => {
    const { showToast } = useToast();
    const canvasRef = useRef<HTMLDivElement>(null);

    // Estado del editor
    const [format, setFormat] = useState<FlyerFormat>('instagram-post');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [customTitle, setCustomTitle] = useState('');
    const [customSubtitle, setCustomSubtitle] = useState('');
    const [backgroundGradient, setBackgroundGradient] = useState<string>('gradient1');
    const [qrCodeDataURL, setQrCodeDataURL] = useState('');
    const [caption, setCaption] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [captionCopied, setCaptionCopied] = useState(false);

    // Opciones de gradientes
    const gradientOptions = [
        { id: 'gradient1', name: 'Azul-Verde', value: 'linear-gradient(135deg, #0ea5e9 0%, #0f766e 100%)' },
        { id: 'gradient2', name: 'Púrpura-Rosa', value: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' },
        { id: 'gradient3', name: 'Naranja-Rojo', value: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)' },
        { id: 'gradient4', name: 'Azul-Índigo', value: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' },
        { id: 'gradient5', name: 'Verde-Esmeralda', value: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' },
        { id: 'gradient6', name: 'Pizarra-Oscuro', value: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' },
    ];

    const selectedGradient = gradientOptions.find(g => g.id === backgroundGradient)?.value || gradientOptions[0].value;

    const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);
    const availableSlots = selectedDoctor
        ? getAvailableSlots(appointments, selectedDoctorId)
        : [];
    const specialties = center ? extractSpecialties(doctors) : [];

    // Generar QR Code
    useEffect(() => {
        const generateQR = async () => {
            let url = '';

            if (type === 'platform') {
                url = 'https://clavesalud.cl';
            } else if (center) {
                url = generateBookingURL(
                    center.slug || center.id,
                    type === 'professional' ? selectedDoctorId : undefined
                );
            }

            if (url) {
                const qr = await generateQRCode(url);
                setQrCodeDataURL(qr);
            }
        };

        generateQR();
    }, [type, center, selectedDoctorId]);

    // Generar Caption
    useEffect(() => {
        if (type === 'platform') {
            setCaption(
                generateCaption({
                    type: 'platform',
                    url: 'https://clavesalud.cl',
                })
            );
        } else if (center) {
            const url = generateBookingURL(
                center.slug || center.id,
                type === 'professional' ? selectedDoctorId : undefined
            );

            setCaption(
                generateCaption({
                    type,
                    centerName: center.name,
                    centerPhone: center.legalInfo?.representativePhone,
                    centerAddress: center.legalInfo?.address,
                    specialties,
                    doctorName: selectedDoctor?.fullName,
                    doctorSpecialty: selectedDoctor?.specialty,
                    availableDates: availableSlots,
                    url,
                })
            );
        }
    }, [type, center, selectedDoctor, availableSlots, specialties, selectedDoctorId]);

    // Copiar caption
    const handleCopyCaption = () => {
        navigator.clipboard.writeText(caption);
        setCaptionCopied(true);
        showToast('Caption copiado al portapapeles', 'success');
        setTimeout(() => setCaptionCopied(false), 2000);
    };

    // Descargar imagen
    const handleDownload = async () => {
        setIsGenerating(true);
        try {
            const canvas = document.getElementById('flyer-canvas');
            if (!canvas) {
                throw new Error('Canvas not found');
            }

            const { width, height } = (canvas as HTMLElement).style;
            const original = await html2canvas(canvas as HTMLElement, {
                scale: 2, // Alta resolución
                backgroundColor: null,
                logging: false,
                useCORS: true,
            });

            // Descargar
            const link = document.createElement('a');
            const fileName = `flyer-${type}-${format}-${Date.now()}.png`;
            link.download = fileName;
            link.href = original.toDataURL('image/png');
            link.click();

            showToast('¡Flyer descargado exitosamente!', 'success');

            // Actualizar estadísticas
            onStatsUpdate?.(type);
        } catch (error) {
            console.error('Error generating image:', error);
            showToast('Error al generar la imagen. Intenta de nuevo.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ImageIcon className="w-6 h-6" />
                        <h2 className="text-xl font-bold">Crear Material de Marketing</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Editor Panel */}
                        <div className="lg:col-span-1 space-y-4">
                            {/* Formato */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Formato
                                </label>
                                <select
                                    value={format}
                                    onChange={e => setFormat(e.target.value as FlyerFormat)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="instagram-post">Instagram Post (1080x1080)</option>
                                    <option value="instagram-story">Instagram Story (1080x1920)</option>
                                    <option value="facebook-post">Facebook Post (1200x630)</option>
                                </select>
                            </div>

                            {/* Profesional (solo para tipo professional) */}
                            {type === 'professional' && doctors.length > 0 && (
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                                        Profesional
                                    </label>
                                    <select
                                        value={selectedDoctorId}
                                        onChange={e => setSelectedDoctorId(e.target.value)}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    >
                                        <option value="">Selecciona un profesional</option>
                                        {doctors.map(doc => (
                                            <option key={doc.id} value={doc.id}>
                                                {doc.fullName} - {doc.specialty}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Título personalizado */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Título (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={customTitle}
                                    onChange={e => setCustomTitle(e.target.value)}
                                    placeholder="Deja vacío para usar el predeterminado"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            {/* Subtítulo personalizado */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Subtítulo (opcional)
                                </label>
                                <textarea
                                    value={customSubtitle}
                                    onChange={e => setCustomSubtitle(e.target.value)}
                                    placeholder="Deja vacío para usar el predeterminado"
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                />
                            </div>

                            {/* Selector de Fondo */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Fondo
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {gradientOptions.map(gradient => (
                                        <button
                                            key={gradient.id}
                                            onClick={() => setBackgroundGradient(gradient.id)}
                                            className={`h-16 rounded-lg border-2 transition-all ${backgroundGradient === gradient.id
                                                ? 'border-blue-500 ring-2 ring-blue-200'
                                                : 'border-slate-200 hover:border-slate-300'
                                                }`}
                                            style={{ background: gradient.value }}
                                            title={gradient.name}
                                        >
                                            {backgroundGradient === gradient.id && (
                                                <Check className="w-5 h-5 text-white mx-auto drop-shadow-lg" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Caption generado */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-semibold text-slate-700">
                                        Caption para Redes Sociales
                                    </label>
                                    <button
                                        onClick={handleCopyCaption}
                                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                                    >
                                        {captionCopied ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Copiado
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4" />
                                                Copiar
                                            </>
                                        )}
                                    </button>
                                </div>
                                <textarea
                                    value={caption}
                                    onChange={e => setCaption(e.target.value)}
                                    rows={10}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                                />
                            </div>
                        </div>

                        {/* Preview Panel */}
                        <div className="lg:col-span-2">
                            <div className="bg-slate-100 rounded-xl p-6 flex items-center justify-center min-h-[550px]">
                                <div ref={canvasRef} className="shadow-2xl">
                                    <FlyerCanvas
                                        type={type}
                                        format={format}
                                        center={center}
                                        doctor={selectedDoctor}
                                        qrCodeDataURL={qrCodeDataURL}
                                        customTitle={customTitle}
                                        customSubtitle={customSubtitle}
                                        specialties={specialties}
                                        availableSlots={availableSlots}
                                        backgroundGradient={selectedGradient}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200 px-6 py-4 bg-slate-50 flex justify-between items-center">
                    <div className="text-sm text-slate-600">
                        💡 El QR code lleva directamente a la página de agendamiento
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition font-medium"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleDownload}
                            disabled={isGenerating || (type === 'professional' && !selectedDoctorId)}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Descargar Imagen
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarketingFlyerModal;
