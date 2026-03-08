import React from "react";
import { ShieldAlert, Info, X } from "lucide-react";

interface TestBannerProps {
    isVisible: boolean;
    onDismiss?: () => void;
}

const TestBanner: React.FC<TestBannerProps> = ({ isVisible, onDismiss }) => {
    if (!isVisible) return null;

    return (
        <div className="bg-amber-600 text-white px-4 py-2 sticky top-0 z-[100] flex items-center justify-between shadow-lg animate-slideDown">
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="bg-white/20 p-1.5 rounded-full flex-shrink-0">
                    <ShieldAlert size={18} className="text-amber-100" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <p className="text-xs sm:text-sm font-black uppercase tracking-widest whitespace-nowrap">
                        Modo Auditoría Activo
                    </p>
                    <div className="hidden sm:block w-1.5 h-1.5 rounded-full bg-white/30"></div>
                    <p className="text-[10px] sm:text-xs font-medium opacity-90 truncate">
                        Estás visualizando una previsualización segura. Los cambios realizados no afectarán datos reales de producción.
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4 ml-4">
                <div className="hidden md:flex items-center gap-2 bg-black/10 px-3 py-1 rounded-full border border-white/10">
                    <Info size={14} />
                    <span className="text-[10px] font-bold uppercase">agent_test v26.03</span>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default TestBanner;
