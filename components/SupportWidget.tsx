import React, { useState } from "react";
import { Headphones, Mail, MessageCircle, X } from "lucide-react";

interface SupportWidgetProps {
  whatsappNumber?: string;
  supportEmail?: string;
  presetMessage?: string;
}

const SupportWidget: React.FC<SupportWidgetProps> = ({
  whatsappNumber = "+56912345678",
  supportEmail = "soporte@clavesalud.cl",
  presetMessage = "Hola, necesito ayuda con ClaveSalud.",
}) => {
  const [open, setOpen] = useState(false);
  const whatsappLink = `https://wa.me/${whatsappNumber.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
    presetMessage
  )}`;
  const mailtoLink = `mailto:${supportEmail}?subject=${encodeURIComponent(
    "Soporte ClaveSalud"
  )}&body=${encodeURIComponent(presetMessage)}`;

  return (
    <div className="fixed bottom-5 right-5 z-[70] flex flex-col items-end gap-3">
      {open && (
        <div className="w-72 rounded-2xl bg-white shadow-xl border border-slate-200 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800">¿Necesitas ayuda?</p>
              <p className="text-xs text-slate-500 mt-1">Estamos disponibles para soporte.</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cerrar soporte"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-4 space-y-2">
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp soporte
            </a>
            <a
              href={mailtoLink}
              className="flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Mail className="w-4 h-4" /> {supportEmail}
            </a>
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-3 shadow-xl hover:bg-slate-800"
      >
        <Headphones className="w-5 h-5" />
        <span className="text-sm font-semibold">Soporte</span>
      </button>
    </div>
  );
};

export default SupportWidget;
