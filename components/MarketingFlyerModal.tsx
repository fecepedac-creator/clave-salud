import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    X,
    Download,
    Copy,
    Check,
    Image as ImageIcon,
    Loader,
    Upload,
    Palette,
    PlusCircle,
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
import { generateAICaption } from '../utils/gemini';

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
    const [customLogo, setCustomLogo] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [captionSource, setCaptionSource] = useState<'default' | 'ai' | 'manual'>('default');

    // AI Generative State
    const [ideaPrompt, setIdeaPrompt] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const resultRef = useRef<HTMLDivElement>(null);
    const [highlightResult, setHighlightResult] = useState(false);

    // Opciones de gradientes
    const gradientOptions = [
        { id: 'gradient1', name: 'Azul-Verde', value: 'linear-gradient(135deg, #0ea5e9 0%, #0f766e 100%)' },
        { id: 'gradient2', name: 'Púrpura-Rosa', value: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' },
        { id: 'gradient3', name: 'Naranja-Rojo', value: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)' },
        { id: 'gradient4', name: 'Azul-Índigo', value: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' },
        { id: 'gradient5', name: 'Verde-Esmeralda', value: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)' },
        { id: 'gradient6', name: 'Pizarra-Oscuro', value: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)' },
        { id: 'custom', name: 'Personalizado', value: center?.branding?.colors?.primary ? `linear-gradient(135deg, ${center.branding.colors.primary} 0%, #1e293b 100%)` : '' },
    ];

    const selectedGradient = gradientOptions.find(g => g.id === backgroundGradient)?.value || gradientOptions[0].value;

    const selectedDoctor = useMemo(() => doctors.find(d => d.id === selectedDoctorId), [doctors, selectedDoctorId]);
    const availableSlots = useMemo(() => selectedDoctor
        ? getAvailableSlots(appointments, selectedDoctorId)
        : [], [appointments, selectedDoctorId, selectedDoctor]);
    const specialties = useMemo(() => center ? extractSpecialties(doctors) : [], [center, doctors]);

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
        // Solo actualizar el caption si es el original. Si el usuario escribió
        // algo (manual) o usó IA (ai), no deberíamos sobrescribir su texto
        if (captionSource !== 'default') return;

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

    // Generar caption con IA
    const handleGenerateAICaption = async () => {
        if (!ideaPrompt.trim()) {
            showToast('Por favor, ingresa una idea sobre qué quieres comunicar', 'warning');
            return;
        }

        setIsGeneratingAI(true);
        try {
            let url = 'https://clavesalud.cl';
            if (center) {
                url = generateBookingURL(
                    center.slug || center.id,
                    type === 'professional' ? selectedDoctorId : undefined
                );
            }

            const context = {
                type,
                centerName: center?.name,
                doctorName: selectedDoctor?.fullName,
                specialties,
                url
            };

            const generatedText = await generateAICaption(ideaPrompt, context);
            setCaption(generatedText);
            setCaptionSource('ai');
            showToast('¡Caption inteligente generado con éxito!', 'success');

            // Scroll to result and highlight
            setTimeout(() => {
                resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightResult(true);
                setTimeout(() => setHighlightResult(false), 2000);
            }, 100);
        } catch (error: any) {
            showToast(error.message || 'Error al generar el texto', 'error');
        } finally {
            setIsGeneratingAI(false);
        }
    };

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
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 bg-white"
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
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 bg-white"
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
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 bg-white"
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
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-slate-800 bg-white"
                                />

                            </div>

                            {/* Selector de Fondo */}
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-2">
                                    Fondo
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {gradientOptions.map(gradient => gradient.value && (
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
                                    {/* Upload custom background (Placeholder/Simulado por ahora ya que requiere Firebase Storage) */}
                                    <button
                                        className="h-16 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400 transition-colors"
                                        title="Subir fondo propio"
                                        onClick={() => showToast('Funcionalidad de subida de archivos en desarrollo...', 'info')}
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span className="text-[10px] uppercase font-bold mt-1">Subir</span>
                                    </button>
                                </div>
                            </div>

                            {/* Brand Kit Section */}
                            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 border-dashed">
                                <div className="flex items-center gap-2 mb-3">
                                    <Palette className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm font-bold text-slate-700 uppercase">Configuración de Marca</span>
                                </div>
                                <div className="space-y-3">
                                    <button
                                        className="w-full py-2 px-3 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition flex items-center justify-between"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <span>{customLogo ? 'Cambiar Logo' : 'Personalizar Logo'}</span>
                                        <Upload className="w-3 h-3" />
                                    </button>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/png, image/jpeg, image/webp, image/svg+xml"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                                if (file.size > 1 * 1024 * 1024) {
                                                    showToast("Logo muy grande. Máximo 1MB para el flyer.", "warning");
                                                }
                                                const reader = new FileReader();
                                                reader.onload = (prev) => setCustomLogo(prev.target?.result as string);
                                                reader.readAsDataURL(file);
                                            }
                                        }}
                                    />
                                    {customLogo && (
                                        <button
                                            className="text-[10px] text-red-500 font-bold uppercase hover:underline"
                                            onClick={() => setCustomLogo(null)}
                                        >
                                            Restablecer logo original
                                        </button>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1">
                                            <label className="text-[10px] text-slate-500 font-bold uppercase">Color Primario</label>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded border border-slate-200" style={{ background: center?.primaryColor || '#14b8a6' }}></div>
                                                <span className="text-xs font-mono text-slate-400 uppercase">{center?.primaryColor}</span>
                                            </div>
                                        </div>
                                        <button className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                                            <PlusCircle className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Caption generado */}
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mt-4 space-y-4">
                                {/* Zona de Prompt IA */}
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-sm font-bold text-blue-900">
                                        ✨ Redactor Inteligente (IA)
                                    </label>
                                    <p className="text-xs text-blue-700 leading-tight">
                                        Escribe la idea principal que deseas comunicar y dejaremos que la Inteligencia Artificial de ClaveSalud redacte el mensaje perfecto.
                                    </p>
                                    <div className="flex flex-col gap-2">
                                        <textarea
                                            value={ideaPrompt}
                                            onChange={e => setIdeaPrompt(e.target.value)}
                                            placeholder='Ej: "Anunciar que tenemos 20% de dcto en kinesiología este mes de marzo"'
                                            rows={2}
                                            className="w-full px-3 py-2 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-slate-800 bg-white resize-none"
                                        />
                                        <button
                                            onClick={handleGenerateAICaption}
                                            disabled={isGeneratingAI || !ideaPrompt.trim()}
                                            className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                        >
                                            {isGeneratingAI ? (
                                                <><Loader className="w-4 h-4 animate-spin" /> Creando magia...</>
                                            ) : (
                                                <><Palette className="w-4 h-4" /> Generar Mensaje</>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Resultado Final */}
                                <div ref={resultRef} className="pt-2 border-t border-blue-200">
                                    <div className="flex items-center justify-between mb-2">
                                        <label className={`block text-sm font-semibold transition-colors duration-500 ${highlightResult ? 'text-green-600' : 'text-slate-700'}`}>
                                            Resultado Final (Listo para publicar)
                                        </label>
                                        <button
                                            onClick={handleCopyCaption}
                                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-bold"
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
                                        onChange={e => {
                                            setCaption(e.target.value);
                                            setCaptionSource('manual');
                                        }}
                                        rows={8}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm text-slate-800 font-medium transition-all duration-500 ${highlightResult ? 'border-green-400 ring-4 ring-green-100 bg-green-50' : 'border-slate-300 bg-white'}`}
                                        placeholder="Tu mensaje aparecerá aquí..."
                                    />
                                </div>
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
                                        customCorporateLogo={customLogo || undefined}
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
