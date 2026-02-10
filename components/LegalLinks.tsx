import React from "react";

interface LegalLinksProps {
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  className?: string;
  buttonClassName?: string;
  showDivider?: boolean;
}

const LegalLinks: React.FC<LegalLinksProps> = ({
  onOpenTerms,
  onOpenPrivacy,
  className = "",
  buttonClassName = "",
  showDivider = true,
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <button
        type="button"
        onClick={onOpenTerms}
        className={`text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors ${buttonClassName}`.trim()}
      >
        Términos y Condiciones
      </button>
      {showDivider && <span className="text-slate-300">•</span>}
      <button
        type="button"
        onClick={onOpenPrivacy}
        className={`text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors ${buttonClassName}`.trim()}
      >
        Política de Privacidad
      </button>
    </div>
  );
};

export default LegalLinks;
