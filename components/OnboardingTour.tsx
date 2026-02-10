import React, { useMemo } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";

export type OnboardingStep = {
  title: string;
  description: string;
};

interface OnboardingTourProps {
  isOpen: boolean;
  steps: OnboardingStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  steps,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onFinish,
}) => {
  const total = steps.length;
  const step = steps[currentStep];
  const progress = useMemo(() => ((currentStep + 1) / total) * 100, [currentStep, total]);

  if (!isOpen || !step) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-emerald-600">Onboarding</p>
              <p className="text-lg font-bold text-slate-800">{step.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cerrar tutorial"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-slate-600 mt-4">{step.description}</p>

        <div className="mt-6">
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
            <span>
              Paso {currentStep + 1} de {total}
            </span>
            <button type="button" onClick={onSkip} className="hover:text-slate-700">
              Saltar tutorial
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentStep === 0}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>

          {currentStep < total - 1 ? (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800"
            >
              Siguiente <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onFinish}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-slate-900 px-4 py-2 text-sm font-semibold hover:bg-emerald-400"
            >
              Finalizar <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
