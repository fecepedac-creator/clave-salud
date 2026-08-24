import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, FileCheck2, Files, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { httpsCallable } from "firebase/functions";
import { auth, functions } from "../firebase";

interface PortalDocument {
  id: string;
  title: string;
  documentType: string;
  publishedAt: string;
  downloadUrl: string | null;
  checksumSha256: string | null;
}

interface PortalConsent {
  id: string;
  title: string;
  version: number;
  content: string;
  contentHashSha256: string;
  publishedAt: string;
}

type AccessState = "checking" | "denied" | "granted";

function consumePortalTokenFromUrl(): string {
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ""));
  const token =
    fragment.get("portalToken")?.trim() || url.searchParams.get("portalToken")?.trim() || "";

  if (token) {
    url.searchParams.delete("portalToken");
    fragment.delete("portalToken");
    const nextFragment = fragment.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${nextFragment ? `#${nextFragment}` : ""}`
    );
  }
  return token;
}

function safeDocumentUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

export default function PatientDocumentsPortal({
  centerId,
  onBack,
}: {
  centerId?: string;
  onBack: () => void;
}) {
  const [token] = useState(consumePortalTokenFromUrl);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [consents, setConsents] = useState<PortalConsent[]>([]);
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [accepted, setAccepted] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [accessState, setAccessState] = useState<AccessState>("checking");

  const loadPublishedContent = useCallback(
    async (memoryToken?: string) => {
      if (!centerId) {
        setAccessState("denied");
        return;
      }
      setLoading(true);
      setError("");
      try {
        const payload = { centerId, ...(memoryToken ? { token: memoryToken } : {}) };
        const [documentResponse, consentResponse] = await Promise.all([
          httpsCallable(functions, "listPublishedPatientDocuments")(payload),
          httpsCallable(functions, "listPublishedPatientConsents")(payload),
        ]);
        setDocuments(
          ((documentResponse.data as { documents?: PortalDocument[] })?.documents || []).slice()
        );
        setConsents(
          ((consentResponse.data as { consents?: PortalConsent[] })?.consents || []).slice()
        );
        setAccessState("granted");
      } catch {
        setDocuments([]);
        setConsents([]);
        setAccessState("denied");
      } finally {
        setLoading(false);
      }
    },
    [centerId]
  );

  useEffect(() => {
    if (token) {
      void loadPublishedContent(token);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      if (user) void loadPublishedContent();
      else setAccessState("denied");
    });
  }, [loadPublishedContent, token]);

  const acceptConsent = async (consent: PortalConsent) => {
    if (!centerId || !confirmed[consent.id]) return;
    setLoading(true);
    setError("");
    try {
      const response = await httpsCallable(
        functions,
        "acceptPublishedPatientConsent"
      )({
        centerId,
        ...(token ? { token } : {}),
        consentId: consent.id,
        version: consent.version,
        contentHashSha256: consent.contentHashSha256,
        accepted: true,
      });
      const result = response.data as { acceptedAt?: string };
      setAccepted((current) => ({
        ...current,
        [consent.id]: result.acceptedAt || new Date().toISOString(),
      }));
    } catch {
      setError("No fue posible registrar la aceptación. No se realizó ningún cambio.");
    } finally {
      setLoading(false);
    }
  };

  if (accessState === "checking") {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
        <div className="rounded-3xl border border-white bg-white/90 p-8 text-center shadow-xl">
          <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 font-medium text-slate-600">Verificando acceso seguro…</p>
        </div>
      </div>
    );
  }

  if (accessState === "denied") {
    return (
      <div className="flex min-h-[calc(100vh-80px)] items-center justify-center p-4">
        <section className="w-full max-w-lg rounded-3xl border border-white bg-white/95 p-8 text-center shadow-xl">
          <LockKeyhole className="mx-auto h-12 w-12 text-slate-500" />
          <h2 className="mt-4 text-2xl font-bold text-slate-800">Acceso personal requerido</h2>
          <p className="mt-3 text-slate-600">
            No fue posible verificar este acceso. Ingresa desde tu sesión de paciente o solicita un
            nuevo enlace seguro a tu centro.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-bold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al portal público
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] px-4 py-20 sm:px-6">
      <main
        className="mx-auto w-full max-w-4xl rounded-3xl border border-indigo-100 bg-white/95 p-6 shadow-xl sm:p-8"
        data-testid="patient-documents-portal"
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-7 w-7 shrink-0 text-indigo-600" />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-indigo-600">
                Mi ClaveSalud
              </p>
              <h2 className="text-2xl font-bold text-slate-800">Documentos y consentimientos</h2>
              <p className="mt-1 text-sm text-slate-500">
                Sólo ves contenido que tu equipo de salud publicó expresamente para ti.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Salir
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">
            {error}
          </div>
        )}

        {documents.length === 0 && consents.length === 0 && (
          <div className="mt-8 rounded-2xl bg-slate-50 p-6 text-center text-slate-600">
            Aún no tienes documentos ni consentimientos publicados.
          </div>
        )}

        {documents.length > 0 && (
          <section className="mt-8 space-y-3">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <Files className="h-5 w-5" /> Documentos publicados
            </h3>
            {documents.map((document) => {
              const downloadUrl = safeDocumentUrl(document.downloadUrl);
              return (
                <article key={document.id} className="rounded-xl border border-slate-200 p-4">
                  <p className="font-bold text-slate-800">{document.title}</p>
                  <p className="text-sm text-slate-500">
                    Publicado: {new Date(document.publishedAt).toLocaleString("es-CL")}
                  </p>
                  {downloadUrl && (
                    <a
                      href={downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block font-bold text-indigo-700"
                    >
                      Abrir documento
                    </a>
                  )}
                </article>
              );
            })}
          </section>
        )}

        {consents.length > 0 && (
          <section className="mt-8 space-y-4">
            <h3 className="flex items-center gap-2 font-bold text-slate-800">
              <FileCheck2 className="h-5 w-5" /> Consentimientos vigentes
            </h3>
            {consents.map((consent) => (
              <article key={consent.id} className="rounded-xl border border-slate-200 p-4">
                <p className="font-bold text-slate-800">{consent.title}</p>
                <p className="text-sm text-slate-500">
                  Versión {consent.version} · Publicado:{" "}
                  {new Date(consent.publishedAt).toLocaleString("es-CL")}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{consent.content}</p>
                <p className="mt-3 break-all font-mono text-xs text-slate-500">
                  Verificación: {consent.contentHashSha256}
                </p>
                {accepted[consent.id] ? (
                  <p className="mt-3 rounded-lg bg-emerald-50 p-3 font-bold text-emerald-700">
                    Aceptado correctamente el{" "}
                    {new Date(accepted[consent.id]).toLocaleString("es-CL")}.
                  </p>
                ) : (
                  <>
                    <label className="mt-4 flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(confirmed[consent.id])}
                        onChange={(event) =>
                          setConfirmed((current) => ({
                            ...current,
                            [consent.id]: event.target.checked,
                          }))
                        }
                      />
                      Confirmo que leí esta versión completa y deseo aceptarla.
                    </label>
                    <button
                      type="button"
                      disabled={loading || !confirmed[consent.id]}
                      onClick={() => void acceptConsent(consent)}
                      className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                    >
                      Aceptar versión {consent.version}
                    </button>
                  </>
                )}
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
