import React, { useMemo, useState } from "react";
import { CheckCircle2, Mail, MessageCircle, ShieldCheck, Star } from "lucide-react";
import LegalLinks from "./LegalLinks";

interface LandingPageProps {
  onBack: () => void;
  onOpenLegal: (target: "terms" | "privacy") => void;
}

const FEATURES = [
  {
    title: "Ficha clínica digital",
    description: "Centraliza antecedentes, consultas y evolución del paciente en una sola vista.",
  },
  {
    title: "Agenda inteligente",
    description: "Coordina reservas, cancelaciones y recordatorios para cada profesional.",
  },
  {
    title: "Cumplimiento normativo",
    description: "Flujos pensados para Ley 19.628 y requerimientos de trazabilidad.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "El onboarding fue muy rápido y el equipo ahora trabaja con todo ordenado en un solo lugar.",
    author: "Clínica Vida Plena",
  },
  {
    quote: "La agenda y los recordatorios redujeron las ausencias en pocas semanas.",
    author: "Centro Salud Ñuñoa",
  },
  {
    quote: "Nos ayudó a cumplir con la documentación exigida sin fricciones.",
    author: "Red Médica Maule",
  },
];

const FAQS = [
  {
    question: "¿Se puede usar desde celular?",
    answer:
      "Sí. ClaveSalud es responsive y está optimizada para uso móvil durante la consulta.",
  },
  {
    question: "¿Qué necesito para comenzar?",
    answer: "Solo un correo corporativo y la información básica de tu centro.",
  },
  {
    question: "¿Tienen soporte?",
    answer: "Sí. Puedes contactarnos por WhatsApp o correo y te ayudamos en la adopción.",
  },
];

const LandingPage: React.FC<LandingPageProps> = ({ onBack, onOpenLegal }) => {
  const [formValues, setFormValues] = useState({ name: "", email: "", message: "" });
  const [formTouched, setFormTouched] = useState(false);
  const [formStatus, setFormStatus] = useState<"idle" | "success">("idle");

  const errors = useMemo(() => {
    const next: Record<string, string> = {};
    if (!formValues.name.trim()) next.name = "Ingresa tu nombre.";
    if (!formValues.email.trim()) {
      next.email = "Ingresa tu correo.";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(formValues.email)) {
      next.email = "Correo inválido.";
    }
    if (!formValues.message.trim()) next.message = "Cuéntanos qué necesitas.";
    return next;
  }, [formValues]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormTouched(true);
    if (Object.keys(errors).length > 0) return;
    setFormStatus("success");
    const subject = encodeURIComponent("Contacto landing ClaveSalud");
    const body = encodeURIComponent(
      `Nombre: ${formValues.name}\nCorreo: ${formValues.email}\n\n${formValues.message}`
    );
    window.location.href = `mailto:soporte@clavesalud.cl?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">
              CS
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-bold">
                ClaveSalud
              </p>
              <p className="text-sm text-slate-500">Plataforma clínica integral</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Volver a la app
          </button>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-900 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16 grid gap-10 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                La plataforma que ordena la operación clínica de tu centro
              </h1>
              <p className="text-lg text-slate-200">
                Centraliza agenda, fichas y comunicación con pacientes en una sola herramienta.
                Diseñada para equipos de salud en Chile.
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-900 font-bold hover:bg-emerald-400"
                  onClick={() =>
                    document.getElementById("contacto")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Solicitar demo
                </button>
                <button
                  type="button"
                  className="px-6 py-3 rounded-xl border border-white/30 font-semibold hover:bg-white/10"
                  onClick={() =>
                    document.getElementById("planes")?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Ver planes
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-300">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-300" /> Ley 19.628
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" /> Implementación guiada
                </span>
              </div>
            </div>
            <div className="bg-white/10 rounded-3xl border border-white/20 p-6 space-y-5">
              <h2 className="text-xl font-bold">Lo que incluye ClaveSalud</h2>
              <ul className="space-y-3 text-sm text-slate-200">
                {FEATURES.map((feature) => (
                  <li key={feature.title} className="flex gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-300" />
                    <div>
                      <p className="font-semibold text-white">{feature.title}</p>
                      <p className="text-slate-300">{feature.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="bg-white/10 rounded-2xl p-4 text-sm">
                <p className="font-semibold">+ Soporte en implementación</p>
                <p className="text-slate-300">Configuración y acompañamiento para tu equipo.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-bold">
              Beneficios
            </p>
            <h2 className="text-3xl font-bold text-slate-900 mt-3">
              Un flujo de atención más ordenado y rentable
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm"
              >
                <h3 className="text-lg font-bold text-slate-900">{feature.title}</h3>
                <p className="text-slate-600 mt-3">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="planes" className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 font-bold">
                  Planes
                </p>
                <h2 className="text-3xl font-bold">Planes diseñados para cada centro</h2>
              </div>
              <p className="text-slate-300 max-w-md">
                Escala desde un equipo pequeño hasta redes con múltiples sedes.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: "Inicio",
                  price: "UF 2,5",
                  description: "Para equipos pequeños que están digitalizando su operación.",
                  highlights: ["1 centro", "Hasta 5 usuarios", "Agenda + Ficha"],
                },
                {
                  title: "Crecimiento",
                  price: "UF 5,5",
                  description: "Para centros con alto flujo de pacientes y múltiples roles.",
                  highlights: ["Hasta 3 centros", "Usuarios ilimitados", "Soporte prioritario"],
                  featured: true,
                },
                {
                  title: "Enterprise",
                  price: "A medida",
                  description: "Integraciones, reporting avanzado y despliegues dedicados.",
                  highlights: ["Integraciones", "SLA dedicado", "Onboarding personalizado"],
                },
              ].map((plan) => (
                <div
                  key={plan.title}
                  className={`rounded-3xl border p-6 ${
                    plan.featured
                      ? "bg-white text-slate-900 border-emerald-400 shadow-xl"
                      : "bg-slate-800/60 border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold">{plan.title}</h3>
                    {plan.featured && (
                      <span className="text-xs font-bold bg-emerald-500 text-slate-900 px-2 py-1 rounded-full">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-3xl font-extrabold mt-4">{plan.price}</p>
                  <p className={`mt-3 ${plan.featured ? "text-slate-600" : "text-slate-300"}`}>
                    {plan.description}
                  </p>
                  <ul className="mt-6 space-y-2 text-sm">
                    {plan.highlights.map((item) => (
                      <li key={item} className="flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${plan.featured ? "text-emerald-500" : "text-emerald-300"}`}
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-bold">
              Testimonios
            </p>
            <h2 className="text-3xl font-bold text-slate-900 mt-3">
              Equipos que ya trabajan con ClaveSalud
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div key={item.author} className="bg-white rounded-3xl border border-slate-200 p-6">
                <div className="flex gap-1 text-amber-400">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-600 mt-4">“{item.quote}”</p>
                <p className="text-sm font-bold text-slate-900 mt-4">{item.author}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-100">
          <div className="max-w-6xl mx-auto px-6 py-16 grid gap-10 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-bold">
                FAQ
              </p>
              <h2 className="text-3xl font-bold text-slate-900 mt-3">
                Preguntas frecuentes
              </h2>
              <div className="mt-8 space-y-4">
                {FAQS.map((faq) => (
                  <div key={faq.question} className="bg-white rounded-2xl p-5 border">
                    <h3 className="font-bold text-slate-900">{faq.question}</h3>
                    <p className="text-slate-600 mt-2">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-slate-200" id="contacto">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-600 font-bold">
                Contacto
              </p>
              <h2 className="text-2xl font-bold text-slate-900 mt-3">
                Agenda una demo con nuestro equipo
              </h2>
              <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">
                    Nombre
                  </label>
                  <input
                    value={formValues.name}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, name: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                    placeholder="Tu nombre"
                  />
                  {formTouched && errors.name && (
                    <p className="text-xs text-rose-500 mt-2">{errors.name}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Correo</label>
                  <input
                    value={formValues.email}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, email: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
                    placeholder="contacto@centro.cl"
                  />
                  {formTouched && errors.email && (
                    <p className="text-xs text-rose-500 mt-2">{errors.email}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Mensaje</label>
                  <textarea
                    value={formValues.message}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, message: event.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 min-h-[120px]"
                    placeholder="Cuéntanos sobre tu centro y necesidades"
                  />
                  {formTouched && errors.message && (
                    <p className="text-xs text-rose-500 mt-2">{errors.message}</p>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-slate-900 text-white font-bold py-3 hover:bg-slate-800"
                >
                  Enviar solicitud
                </button>
                {formStatus === "success" && (
                  <p className="text-sm text-emerald-600 font-semibold">
                    ¡Listo! Te contactaremos a la brevedad.
                  </p>
                )}
              </form>
              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-600" /> soporte@clavesalud.cl
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-600" /> +56 9 1234 5678
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <p className="text-sm text-slate-500">© 2024 ClaveSalud. Todos los derechos reservados.</p>
          <LegalLinks
            onOpenTerms={() => onOpenLegal("terms")}
            onOpenPrivacy={() => onOpenLegal("privacy")}
          />
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
