import React, { useState, useEffect } from 'react';
import { FLYER_DIMENSIONS, FlyerFormat, FlyerType, LEGAL_DISCLAIMER } from '../utils/flyerGenerator';
import { MedicalCenter, Doctor } from '../types';
import { CORPORATE_LOGO } from '../constants';

interface FlyerCanvasProps {
    type: FlyerType;
    format: FlyerFormat;
    center?: MedicalCenter;
    doctor?: Doctor;
    qrCodeDataURL: string;
    customTitle?: string;
    customSubtitle?: string;
    specialties?: string[];
    availableSlots?: { date: string; times: string[] }[];
    backgroundGradient?: string;
    customCorporateLogo?: string;
}

const FlyerCanvas: React.FC<FlyerCanvasProps> = ({
    type,
    format,
    center,
    doctor,
    qrCodeDataURL,
    customTitle,
    customSubtitle,
    specialties,
    availableSlots,
    backgroundGradient = 'linear-gradient(135deg, #0ea5e9 0%, #0f766e 100%)',
    customCorporateLogo,
}) => {
    const dims = FLYER_DIMENSIONS[format];
    const isSquare = format === 'instagram-post';
    const isStory = format === 'instagram-story';
    const isFacebook = format === 'facebook-post';

    // Escala para visualización (ajustada dinámicamente según formato)
    // Valores reducidos para garantizar que TODO cabe sin scroll
    const scale = isStory ? 0.28 : (isSquare ? 0.42 : 0.48);
    // Story: 1920*0.28 = 537px alto
    // Square: 1080*0.42 = 454px alto  
    // Facebook: 630*0.48 = 302px alto
    const displayWidth = dims.width * scale;
    const displayHeight = dims.height * scale;

    // Plantilla ClaveSalud Platform
    if (type === 'platform') {
        return (
            // Contenedor centrador
            <div style={{ width: `${displayWidth}px`, height: `${displayHeight}px`, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <div
                    id="flyer-canvas"
                    style={{
                        width: `${dims.width}px`,
                        height: `${dims.height}px`,
                        transform: `scale(${scale})`,
                        background: backgroundGradient,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: isStory ? '50px 30px' : '40px 50px',
                        paddingBottom: '30px',
                        boxSizing: 'border-box',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        color: '#ffffff',
                        position: 'relative',
                    }}
                >
                    {/* Contenido principal (flex-grow para empujar disclaimer abajo) */}
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        flex: 1,
                        justifyContent: 'center',
                        width: '100%',
                    }}>
                        {/* Logo ClaveSalud */}
                        <div style={{ marginBottom: isStory ? '40px' : '50px', display: 'flex', justifyContent: 'center' }}>
                            <img
                                src={customCorporateLogo || CORPORATE_LOGO}
                                alt="ClaveSalud"
                                style={{
                                    width: isStory ? '350px' : isFacebook ? '400px' : '450px',
                                    height: 'auto',
                                    maxHeight: isStory ? '150px' : '200px',
                                    objectFit: 'contain'
                                }}
                            />
                        </div>

                        {/* Título */}
                        <h1
                            style={{
                                fontSize: isStory ? '58px' : isFacebook ? '52px' : '68px',
                                fontWeight: '800',
                                textAlign: 'center',
                                marginBottom: isStory ? '25px' : '35px',
                                lineHeight: '1.1',
                                textShadow: '2px 2px 8px rgba(0,0,0,0.2)',
                                margin: 0,
                                padding: 0,
                            }}
                        >
                            {customTitle || '🏥 DIGITALIZA TU CENTRO MÉDICO'}
                        </h1>

                        {/* Subtítulo */}
                        <p
                            style={{
                                fontSize: isStory ? '32px' : isFacebook ? '28px' : '36px',
                                textAlign: 'center',
                                marginBottom: isStory ? '35px' : '45px',
                                opacity: 0.95,
                                maxWidth: '85%',
                                margin: `0 auto ${isStory ? '35px' : '45px'}`,
                            }}
                        >
                            {customSubtitle || 'Gestión profesional de fichas clínicas'}
                        </p>

                        {/* Beneficios */}
                        <div style={{
                            marginBottom: isStory ? '35px' : '45px',
                            fontSize: isStory ? '28px' : isFacebook ? '24px' : '32px',
                            lineHeight: '1.7',
                            textAlign: 'center',
                        }}>
                            <div>✓ Fichas clínicas digitales</div>
                            <div>✓ Agenda inteligente</div>
                            <div>✓ Recetas electrónicas</div>
                        </div>

                        {/* QR Code */}
                        <div
                            style={{
                                background: '#ffffff',
                                padding: isStory ? '20px' : '22px',
                                borderRadius: '18px',
                                marginBottom: isStory ? '20px' : '25px',
                                display: 'inline-block',
                            }}
                        >
                            <img src={qrCodeDataURL} alt="QR Code" style={{ width: isStory ? '180px' : '190px', height: isStory ? '180px' : '190px', display: 'block' }} />
                        </div>

                        {/* URL */}
                        <div
                            style={{
                                fontSize: isStory ? '28px' : isFacebook ? '24px' : '30px',
                                fontWeight: '600',
                                letterSpacing: '0.5px',
                            }}
                        >
                            www.clavesalud.cl
                        </div>
                    </div>

                    {/* Legal Disclaimer - Sin absolute positioning */}
                    <div
                        style={{
                            fontSize: isStory ? '14px' : '16px',
                            opacity: 0.65,
                            textAlign: 'center',
                            maxWidth: '95%',
                            marginTop: '20px',
                            lineHeight: '1.3',
                        }}
                    >
                        {LEGAL_DISCLAIMER}
                    </div>
                </div>
            </div>
        );
    }

    // Plantilla Centro Médico
    if (type === 'center' && center) {
        const primaryColor = center.primaryColor || 'teal';
        const colorMap: Record<string, string> = {
            teal: '#14b8a6',
            blue: '#3b82f6',
            indigo: '#6366f1',
            purple: '#a855f7',
            pink: '#ec4899',
            red: '#ef4444',
            orange: '#f97316',
            green: '#22c55e',
        };

        return (
            // Contenedor centrador
            <div style={{ width: `${displayWidth}px`, height: `${displayHeight}px`, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <div
                    id="flyer-canvas"
                    style={{
                        width: `${dims.width}px`,
                        height: `${dims.height}px`,
                        transform: `scale(${scale})`,
                        background: backgroundGradient.includes('linear-gradient') ? backgroundGradient : `linear-gradient(135deg, ${colorMap[center?.primaryColor || 'teal'] || '#14b8a6'}, #1e293b)`,
                        padding: isStory ? '50px 40px' : '50px 50px',
                        paddingBottom: '35px',
                        boxSizing: 'border-box',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        color: '#ffffff',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                    }}
                >
                    {/* Contenido principal */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Header con logos */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '40px',
                            }}
                        >
                            {/* Logo del Centro (Prioriza BrandKit) */}
                            {center.branding?.logoUrls?.[0] || center.logoUrl ? (
                                <img
                                    src={center.branding?.logoUrls?.[0] || center.logoUrl}
                                    alt={center.name}
                                    style={{ maxWidth: '180px', maxHeight: '100px', objectFit: 'contain' }}
                                />
                            ) : (
                                <div style={{ fontSize: '48px', fontWeight: '700' }}>
                                    {center.name.substring(0, 2).toUpperCase()}
                                </div>
                            )}

                            {/* Logo ClaveSalud (marca de agua) */}
                            <img
                                src={customCorporateLogo || CORPORATE_LOGO}
                                alt="ClaveSalud"
                                style={{ width: '120px', maxHeight: '60px', opacity: 0.6, objectFit: 'contain' }}
                            />
                        </div>

                        {/* Nombre del Centro */}
                        <h1
                            style={{
                                fontSize: isStory ? '56px' : isFacebook ? '48px' : '64px',
                                fontWeight: '800',
                                lineHeight: '1.2',
                                margin: '0 0 20px 0',
                                padding: 0,
                            }}
                        >
                            {customTitle || center.name}
                        </h1>

                        {/* Subtítulo */}
                        <p
                            style={{
                                fontSize: isStory ? '32px' : '36px',
                                opacity: 0.9,
                                margin: '0 0 40px 0',
                                padding: 0,
                            }}
                        >
                            {customSubtitle || 'Tu salud, nuestra prioridad'}
                        </p>

                        {/* Especialidades */}
                        {specialties && specialties.length > 0 && (
                            <div style={{ marginBottom: '40px' }}>
                                <div style={{ fontSize: '32px', fontWeight: '600', marginBottom: '20px' }}>
                                    📌 Especialidades:
                                </div>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: isStory || isFacebook ? '1fr' : '1fr 1fr',
                                        gap: '12px',
                                        fontSize: '26px',
                                    }}
                                >
                                    {specialties.slice(0, 6).map((spec, i) => (
                                        <div key={i}>• {spec}</div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Información de contacto */}
                        <div style={{ marginBottom: '40px', fontSize: '28px', lineHeight: '1.8' }}>
                            {center.legalInfo?.representativePhone && (
                                <div>📞 {center.legalInfo.representativePhone}</div>
                            )}
                            {center.legalInfo?.address && (
                                <div style={{ maxWidth: '80%' }}>📍 {center.legalInfo.address}</div>
                            )}
                        </div>

                        {/* QR Code + CTA */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '30px',
                                marginTop: 'auto',
                            }}
                        >
                            <div
                                style={{
                                    background: '#ffffff',
                                    padding: '16px',
                                    borderRadius: '16px',
                                }}
                            >
                                <img src={qrCodeDataURL} alt="QR Code" style={{ width: '150px', height: '150px', display: 'block' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '8px' }}>
                                    AGENDA TU HORA
                                </div>
                                <div style={{ fontSize: '24px', opacity: 0.9 }}>clavesalud.cl</div>
                            </div>
                        </div>
                    </div>

                    {/* Sello de Confianza ClaveSalud (Esquina inferior derecha) */}
                    <div style={{ position: 'absolute', bottom: '20px', right: '30px', opacity: 0.5, display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Digitalizado por</span>
                        <img src={customCorporateLogo || CORPORATE_LOGO} alt="ClaveSalud" style={{ height: '30px', width: 'auto', objectFit: 'contain' }} />
                    </div>

                    {/* Legal - Sin absolute */}
                    <div
                        style={{
                            fontSize: '14px',
                            opacity: 0.6,
                            textAlign: 'center',
                            marginTop: '25px',
                            lineHeight: '1.3',
                        }}
                    >
                        {LEGAL_DISCLAIMER}
                    </div>
                </div>
            </div>
        );
    }

    // Plantilla Profesional + Horas
    if (type === 'professional' && doctor) {
        return (
            // Contenedor centrador
            <div style={{ width: `${displayWidth}px`, height: `${displayHeight}px`, display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                <div
                    id="flyer-canvas"
                    style={{
                        width: `${dims.width}px`,
                        height: `${dims.height}px`,
                        transform: `scale(${scale})`,
                        background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                        padding: isStory ? '50px 40px' : '50px 50px',
                        paddingBottom: '35px',
                        boxSizing: 'border-box',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                        color: '#ffffff',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                    }}
                >
                    {/* Contenido principal */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {/* Profesional Info */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '30px', marginBottom: '40px' }}>
                            {doctor.photoUrl ? (
                                <img
                                    src={doctor.photoUrl}
                                    alt={doctor.fullName}
                                    style={{
                                        width: '150px',
                                        height: '150px',
                                        borderRadius: '50%',
                                        objectFit: 'cover',
                                        border: '4px solid #3b82f6',
                                    }}
                                />
                            ) : (
                                <div
                                    style={{
                                        width: '150px',
                                        height: '150px',
                                        borderRadius: '50%',
                                        background: '#3b82f6',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '64px',
                                        fontWeight: '700',
                                    }}
                                >
                                    {doctor.fullName.substring(0, 2).toUpperCase()}
                                </div>
                            )}

                            <div>
                                <h1 style={{ fontSize: isStory ? '52px' : '56px', fontWeight: '800', margin: '0 0 12px 0' }}>
                                    {doctor.fullName}
                                </h1>
                                <p style={{ fontSize: '36px', color: '#60a5fa', margin: 0 }}>{doctor.specialty}</p>
                            </div>
                        </div>

                        {/* Horas Disponibles */}
                        <div
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '20px',
                                padding: '35px',
                                marginBottom: '35px',
                            }}
                        >
                            <div style={{ fontSize: '36px', fontWeight: '700', marginBottom: '25px', color: '#60a5fa' }}>
                                🗓️ HORAS DISPONIBLES:
                            </div>
                            {availableSlots && availableSlots.length > 0 ? (
                                <div style={{ fontSize: '26px', lineHeight: '1.7' }}>
                                    {availableSlots.map((slot, i) => (
                                        <div key={i} style={{ marginBottom: '10px' }}>
                                            📅 {slot.date} → {slot.times.join(', ')}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ fontSize: '26px', opacity: 0.8 }}>Consulta disponibilidad actualizada</div>
                            )}
                        </div>

                        {/* CTA + QR */}
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '44px', fontWeight: '800', marginBottom: '25px', color: '#3b82f6' }}>
                                AGENDA AHORA
                            </div>
                            <div
                                style={{
                                    background: '#ffffff',
                                    padding: '18px',
                                    borderRadius: '16px',
                                    display: 'inline-block',
                                    marginBottom: '15px',
                                }}
                            >
                                <img src={qrCodeDataURL} alt="QR Code" style={{ width: '170px', height: '170px', display: 'block' }} />
                            </div>
                        </div>
                    </div>

                    {/* Footer + Legal - Sin absolute */}
                    <div style={{ marginTop: '25px' }}>
                        {/* Footer */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '15px',
                            }}
                        >
                            {center?.logoUrl && (
                                <img
                                    src={center.logoUrl}
                                    alt={center.name}
                                    style={{ maxWidth: '120px', maxHeight: '60px', objectFit: 'contain' }}
                                />
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', opacity: 0.6 }}>
                                <span style={{ fontSize: '10px', fontWeight: 'bold' }}>RESPALDADO POR</span>
                                <img src={customCorporateLogo || CORPORATE_LOGO} alt="ClaveSalud" style={{ height: '25px', width: 'auto', objectFit: 'contain' }} />
                            </div>
                            <div style={{ fontSize: '22px', opacity: 0.8 }}>clavesalud.cl</div>
                        </div>

                        {/* Legal */}
                        <div
                            style={{
                                fontSize: '13px',
                                opacity: 0.5,
                                textAlign: 'center',
                                lineHeight: '1.3',
                            }}
                        >
                            {LEGAL_DISCLAIMER}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Fallback
    return (
        <div
            style={{
                width: `${displayWidth}px`,
                height: `${displayHeight}px`,
                background: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                fontSize: '24px',
            }}
        >
            Selecciona un tipo de plantilla
        </div>
    );
};

export default FlyerCanvas;
