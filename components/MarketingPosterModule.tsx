import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getDownloadURL, ref } from "firebase/storage";
import { db, storage } from "../firebase";
import { useToast } from "./Toast";

type PosterFormat = "feed" | "story" | "whatsapp" | "internal";

type MarketingSettings = {
  enabled?: boolean;
  monthlyPosterLimit?: number;
  allowPosterRetention?: boolean;
  posterRetentionDays?: number;
  retentionEnabled?: boolean;
};

type PosterItem = {
  id: string;
  format: PosterFormat;
  message: string;
  createdAt?: string;
  storagePath?: string;
  imageUrl?: string;
};

type Props = {
  centerId: string;
  centerName: string;
};

const DEFAULT_SETTINGS: MarketingSettings = {
  enabled: false,
  monthlyPosterLimit: 0,
  allowPosterRetention: false,
  posterRetentionDays: 7,
  retentionEnabled: false,
};

const FORMAT_OPTIONS: Array<{ id: PosterFormat; label: string }> = [
  { id: "feed", label: "Instagram/Facebook (Feed) — 4:5" },
  { id: "story", label: "Instagram/Facebook (Historias) — 9:16" },
  { id: "whatsapp", label: "WhatsApp — 1:1 o 4:5 compacto" },
  { id: "internal", label: "Pantalla interna — 16:9" },
];

const monthKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
};

export default function MarketingPosterModule({ centerId, centerName }: Props) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<MarketingSettings>(DEFAULT_SETTINGS);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [usage, setUsage] = useState<{ used: number; limit: number }>({ used: 0, limit: 0 });
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState<PosterFormat>("feed");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [history, setHistory] = useState<PosterItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const hasUnlimitedLimit = useMemo(
    () => Number(settings.monthlyPosterLimit) === -1,
    [settings.monthlyPosterLimit]
  );

  const canUseModule = useMemo(() => {
    if (!settings.enabled) return false;
    if (settings.monthlyPosterLimit === undefined || settings.monthlyPosterLimit === null) {
      return false;
    }
    return settings.monthlyPosterLimit > 0 || settings.monthlyPosterLimit === -1;
  }, [settings.enabled, settings.monthlyPosterLimit]);

  const loadSettings = async () => {
    if (!centerId) return;
    setLoadingSettings(true);
    try {
      const snap = await getDoc(doc(db, "centers", centerId, "settings", "marketing"));
      if (snap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...(snap.data() as MarketingSettings) });
      } else {
        setSettings(DEFAULT_SETTINGS);
      }
    } catch (e) {
      console.error("load marketing settings", e);
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadUsage = async () => {
    if (!centerId) return;
    try {
      const snap = await getDoc(
        doc(db, "centers", centerId, "stats", "postersMonthly", monthKey())
      );
      if (snap.exists()) {
        const data = snap.data() as any;
        setUsage({
          used: Number(data.used || 0),
          limit: Number(data.limit ?? settings.monthlyPosterLimit ?? 0),
        });
      } else {
        setUsage({ used: 0, limit: Number(settings.monthlyPosterLimit || 0) });
      }
    } catch (e) {
      console.error("load poster usage", e);
      setUsage({ used: 0, limit: Number(settings.monthlyPosterLimit || 0) });
    }
  };

  const loadHistory = async () => {
    if (!centerId || !settings.allowPosterRetention || !settings.retentionEnabled) return;
    setHistoryLoading(true);
    try {
      const q = query(
        collection(db, "centers", centerId, "posters"),
        orderBy("createdAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(q);
      const items = await Promise.all(
        snap.docs.map(async (docSnap) => {
          const data = docSnap.data() as any;
          const storagePath = String(data.storagePath || "");
          let imageUrl = "";
          if (storagePath) {
            try {
              imageUrl = await getDownloadURL(ref(storage, storagePath));
            } catch (err) {
              console.warn("poster download url", err);
            }
          }
          return {
            id: docSnap.id,
            format: data.format as PosterFormat,
            message: data.message || "",
            createdAt: data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAtISO || "",
            storagePath,
            imageUrl,
          } as PosterItem;
        })
      );
      setHistory(items.filter((item) => item.imageUrl));
    } catch (e) {
      console.error("load poster history", e);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, [centerId]);

  useEffect(() => {
    if (!loadingSettings) {
      void loadUsage();
      void loadHistory();
    }
  }, [loadingSettings, settings.allowPosterRetention, settings.retentionEnabled]);

  const handleRetentionToggle = async (nextValue: boolean) => {
    if (!centerId || !settings.allowPosterRetention) return;
    try {
      await setDoc(
        doc(db, "centers", centerId, "settings", "marketing"),
        { retentionEnabled: nextValue, updatedAt: serverTimestamp() },
        { merge: true }
      );
      setSettings((prev) => ({ ...prev, retentionEnabled: nextValue }));
      if (!nextValue) {
        setHistory([]);
      } else {
        void loadHistory();
      }
    } catch (e) {
      console.error("update retention setting", e);
      showToast("No se pudo actualizar la opción de retención.", "error");
    }
  };

  const handleGenerate = async () => {
    if (!centerId) return;
    const cleanMessage = message.trim();
    if (!cleanMessage) {
      showToast("Debes escribir un mensaje corto para el afiche.", "warning");
      return;
    }
    setIsGenerating(true);
    setPreviewUrl("");
    try {
      const fn = httpsCallable(getFunctions(), "generateMarketingPoster");
      const res = await fn({ centerId, format, message: cleanMessage });
      const data = res.data as any;
      if (data?.imageDataUrl) {
        setPreviewUrl(data.imageDataUrl);
      } else if (data?.imageUrl) {
        setPreviewUrl(data.imageUrl);
      }
      await loadUsage();
      if (settings.allowPosterRetention && settings.retentionEnabled) {
        await loadHistory();
      }
      showToast("Afiche generado con éxito.", "success");
    } catch (e: any) {
      console.error("generate poster error", e);
      const msg = e?.message || "";
      if (msg.includes("LIMIT_REACHED")) {
        showToast(
          "Has alcanzado el límite de afiches de este mes. Puedes esperar al próximo mes o solicitar a tu administrador de ClaveSalud un aumento del límite.",
          "warning"
        );
      } else if (msg.includes("NOT_ENABLED")) {
        showToast("El módulo de marketing no está habilitado para este centro.", "error");
      } else if (msg.includes("PERMISSION_DENIED")) {
        showToast("No tienes permisos para generar afiches en este centro.", "error");
      } else {
        showToast("No se pudo generar el afiche. Intenta nuevamente.", "error");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (url: string) => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = `afiche-${centerName}-${format}.svg`;
    link.click();
  };

  if (loadingSettings) {
    return (
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="text-sm text-slate-500">Cargando módulo de afiches...</div>
      </div>
    );
  }

  if (!canUseModule) {
    return null;
  }

  const usageLabel = hasUnlimitedLimit
    ? `${usage.used} / ∞`
    : `${usage.used} / ${usage.limit || settings.monthlyPosterLimit || 0}`;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-800">Afiche para Redes Sociales</h3>
          <p className="text-sm text-slate-500">
            Genera un afiche profesional y sobrio para comunicar disponibilidad de horas.
          </p>
        </div>
        <div className="text-sm font-semibold text-slate-600">Este mes: {usageLabel}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="text-xs font-bold text-slate-400 uppercase">Mensaje del afiche</span>
          <textarea
            className="w-full mt-1 p-3 border rounded-xl min-h-[110px]"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ej: Lunes: horas disponibles con Dr. Juan Pérez – Cardiología"
          />
          <p className="text-xs text-slate-500 mt-2">
            Escribe un mensaje corto y claro para informar disponibilidad de horas. Evita promesas
            de salud o afirmaciones clínicas.
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-bold text-slate-400 uppercase">Formato</span>
          <select
            className="w-full mt-1 p-3 border rounded-xl"
            value={format}
            onChange={(e) => setFormat(e.target.value as PosterFormat)}
          >
            {FORMAT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col justify-end gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full px-4 py-3 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 disabled:opacity-60"
          >
            {isGenerating ? "Generando..." : "Generar afiche"}
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={() => handleDownload(previewUrl)}
              className="w-full px-4 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200"
            >
              Descargar
            </button>
          )}
        </div>
      </div>

      {settings.allowPosterRetention && (
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-100 p-4">
          <input
            id="poster-retention"
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={Boolean(settings.retentionEnabled)}
            onChange={(e) => handleRetentionToggle(e.target.checked)}
          />
          <label htmlFor="poster-retention" className="text-sm text-slate-700">
            <span className="font-semibold">
              Guardar afiches por 7 días para re-descarga
            </span>
            <span className="block text-xs text-slate-500 mt-1">
              Si activas esta opción, podrás volver a descargar los afiches generados durante los
              próximos 7 días. Si no la activas, el afiche se descargará una sola vez.
            </span>
          </label>
        </div>
      )}

      {previewUrl && (
        <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
          <div className="text-xs font-bold text-slate-400 uppercase mb-2">Preview</div>
          <div className="flex justify-center">
            <img
              src={previewUrl}
              alt="Preview afiche"
              className="max-h-[420px] rounded-lg shadow"
            />
          </div>
        </div>
      )}

      {settings.allowPosterRetention && settings.retentionEnabled && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-400 uppercase">Historial</div>
          {historyLoading ? (
            <div className="text-sm text-slate-500">Cargando historial...</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-slate-500">
              Aún no hay afiches guardados para este centro.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-3 space-y-2"
                >
                  <img
                    src={item.imageUrl}
                    alt={`Afiche ${item.format}`}
                    className="rounded-lg max-h-40 w-full object-cover"
                  />
                  <div className="text-xs text-slate-500">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                  </div>
                  <div className="text-xs font-semibold text-slate-700">
                    {FORMAT_OPTIONS.find((opt) => opt.id === item.format)?.label || item.format}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(item.imageUrl || "")}
                    className="w-full px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200"
                  >
                    Descargar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
