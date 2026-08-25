import React, { useMemo, useState } from "react";
import { Consultation, ExamDefinition, ExamProfile, ExamSheet } from "../types";
import { generateId } from "../utils";
import {
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { HistoryPoint, MiniTrendChart } from "./MiniTrendChart";

const DATE_COLUMNS_PER_PAGE = 4;

interface ExamSheetsSectionProps {
  examSheets: ExamSheet[];
  onChange: (sheets: ExamSheet[]) => void;
  examOptions: ExamDefinition[];
  availableProfiles: ExamProfile[];
  consultationHistory: Consultation[];
  legacyExams?: Record<string, string>;
}

const today = () => new Date().toISOString().slice(0, 10);

export const ExamTimelineMatrix: React.FC<ExamSheetsSectionProps> = ({
  examSheets,
  onChange,
  examOptions,
  availableProfiles,
  consultationHistory,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [examSearch, setExamSearch] = useState("");
  const [customExamName, setCustomExamName] = useState("");
  const [expandedColumnId, setExpandedColumnId] = useState<string | null>(null);
  const [trendExamId, setTrendExamId] = useState<string | null>(null);
  const [visibleColumnStart, setVisibleColumnStart] = useState(0);

  const sortedExamOptions = useMemo(
    () => [...examOptions].sort((a, b) => a.label.localeCompare(b.label, "es")),
    [examOptions]
  );

  const examIds = useMemo(
    () =>
      Array.from(new Set(examSheets.flatMap((sheet) => Object.keys(sheet.exams)))).sort((a, b) => {
        const aLabel = examOptions.find((exam) => exam.id === a)?.label || a;
        const bLabel = examOptions.find((exam) => exam.id === b)?.label || b;
        return aLabel.localeCompare(bLabel, "es");
      }),
    [examOptions, examSheets]
  );

  const safeVisibleColumnStart = Math.min(
    visibleColumnStart,
    Math.max(0, examSheets.length - DATE_COLUMNS_PER_PAGE)
  );
  const visibleSheets = examSheets.slice(
    safeVisibleColumnStart,
    safeVisibleColumnStart + DATE_COLUMNS_PER_PAGE
  );

  const getLabel = (examId: string) => {
    const definition = examOptions.find((exam) => exam.id === examId);
    return (
      definition?.label ||
      examSheets.find((sheet) => sheet.customExamLabels?.[examId])?.customExamLabels?.[examId] ||
      examId
    );
  };

  const getUnit = (examId: string) => examOptions.find((exam) => exam.id === examId)?.unit || "";

  const updateSheet = (sheetId: string, updates: Partial<ExamSheet>) => {
    onChange(examSheets.map((sheet) => (sheet.id === sheetId ? { ...sheet, ...updates } : sheet)));
  };

  const ensureCurrentSheet = (): ExamSheet => {
    const existing = examSheets[examSheets.length - 1];
    if (existing) return existing;
    const sheet: ExamSheet = {
      id: generateId(),
      date: today(),
      exams: {},
      source: "patient_provided",
    };
    onChange([sheet]);
    return sheet;
  };

  const addDateColumn = () => {
    const newSheet: ExamSheet = {
      id: generateId(),
      date: today(),
      exams: {},
      source: "patient_provided",
    };
    onChange([...examSheets, newSheet]);
    setVisibleColumnStart(
      Math.floor(examSheets.length / DATE_COLUMNS_PER_PAGE) * DATE_COLUMNS_PER_PAGE
    );
    setExpandedColumnId(newSheet.id);
    setIsExpanded(true);
  };

  const addExam = (examId: string, customLabel?: string) => {
    const current = ensureCurrentSheet();
    const nextExams = { ...current.exams, [examId]: current.exams[examId] || "" };
    const nextLabels = customLabel
      ? { ...current.customExamLabels, [examId]: customLabel }
      : current.customExamLabels;
    const updated = {
      ...current,
      exams: nextExams,
      ...(nextLabels ? { customExamLabels: nextLabels } : {}),
    };
    onChange(
      examSheets.length
        ? examSheets.map((sheet) => (sheet.id === current.id ? updated : sheet))
        : [updated]
    );
  };

  const addCustomExam = () => {
    const label = customExamName.trim();
    if (!label) return;
    const slug = label
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    addExam(`manual:${slug || "examen"}`, label);
    setCustomExamName("");
  };

  const addProfile = (profileId: string) => {
    const profile = availableProfiles.find((item) => item.id === profileId);
    if (!profile) return;
    const baseSheets = examSheets.length
      ? examSheets
      : [
          {
            id: generateId(),
            date: today(),
            exams: {},
            source: "patient_provided" as const,
          },
        ];
    const current = baseSheets[baseSheets.length - 1];
    onChange(
      baseSheets.map((sheet) =>
        sheet.id === current.id
          ? {
              ...sheet,
              exams: {
                ...sheet.exams,
                ...Object.fromEntries(
                  profile.exams.map((examId) => [examId, sheet.exams[examId] || ""])
                ),
              },
            }
          : sheet
      )
    );
  };

  const removeExamRow = (examId: string) => {
    onChange(
      examSheets.map((sheet) => {
        const exams = { ...sheet.exams };
        const customExamLabels = { ...sheet.customExamLabels };
        delete exams[examId];
        delete customExamLabels[examId];
        return {
          ...sheet,
          exams,
          ...(Object.keys(customExamLabels).length
            ? { customExamLabels }
            : { customExamLabels: undefined }),
        };
      })
    );
  };

  const removeDateColumn = (sheetId: string) => {
    if (window.confirm("Â¿Eliminar esta fecha y todos sus valores registrados?")) {
      onChange(examSheets.filter((sheet) => sheet.id !== sheetId));
    }
  };

  const setExamValue = (sheetId: string, examId: string, value: string) => {
    const sheet = examSheets.find((item) => item.id === sheetId);
    if (!sheet) return;
    updateSheet(sheetId, { exams: { ...sheet.exams, [examId]: value } });
  };

  const getExamHistory = (examId: string): HistoryPoint[] => {
    const history: HistoryPoint[] = [];
    examSheets.forEach((sheet) => {
      if (sheet.exams[examId]) {
        history.push({
          date: new Date(sheet.date).toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "2-digit",
          }),
          fullDate: sheet.date,
          value: Number.parseFloat(sheet.exams[examId]),
        });
      }
    });
    consultationHistory.forEach((consultation) => {
      if (consultation.exams?.[examId]) {
        history.push({
          date: new Date(consultation.date).toLocaleDateString("es-CL", {
            day: "2-digit",
            month: "2-digit",
          }),
          fullDate: consultation.date,
          value: Number.parseFloat(consultation.exams[examId]),
        });
      }
      consultation.examSheets?.forEach((sheet) => {
        if (sheet.exams[examId]) {
          history.push({
            date: new Date(sheet.date).toLocaleDateString("es-CL", {
              day: "2-digit",
              month: "2-digit",
            }),
            fullDate: sheet.date,
            value: Number.parseFloat(sheet.exams[examId]),
          });
        }
      });
    });
    return history
      .filter((point) => Number.isFinite(point.value))
      .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm animate-fadeIn">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-slate-50 p-6 text-left transition-colors hover:bg-slate-100"
        onClick={() => setIsExpanded((previous) => !previous)}
      >
        <span className="flex items-center gap-3">
          <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
          <span>
            <span className="block text-lg font-bold text-slate-800">ExÃ¡menes de seguimiento</span>
            <span className="block text-sm text-slate-500">
              Matriz longitudinal: una columna por fecha, una fila por examen.
            </span>
          </span>
        </span>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="space-y-5 border-t border-slate-100 p-5">
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-sm font-semibold text-indigo-950">
              Agregue una fecha cuando tenga un nuevo control. Los exÃ¡menes permanecen como filas y
              podrÃ¡ comparar sus valores a lo largo del tiempo.
            </p>
            <div className="mt-3 flex flex-col gap-3 lg:flex-row">
              <select
                aria-label="Agregar perfil de exÃ¡menes"
                defaultValue=""
                className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white p-2.5 text-sm font-medium text-slate-700"
                onChange={(event) => {
                  if (event.target.value) {
                    addProfile(event.target.value);
                    event.target.value = "";
                  }
                }}
              >
                <option value="">Agregar perfil de exÃ¡menesâ€¦</option>
                {availableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label} ({profile.summary || `${profile.exams.length} exÃ¡menes`})
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1">
                <input
                  list="tracked-exams"
                  value={examSearch}
                  placeholder="Buscar examen para aÃ±adir filaâ€¦"
                  className="w-full rounded-xl border border-indigo-200 bg-white p-2.5 text-sm font-medium text-slate-700"
                  onChange={(event) => {
                    const value = event.target.value;
                    setExamSearch(value);
                    const exact = sortedExamOptions.find(
                      (exam) => exam.label.toLocaleLowerCase("es") === value.toLocaleLowerCase("es")
                    );
                    if (exact) {
                      addExam(exact.id);
                      setExamSearch("");
                    }
                  }}
                />
                <datalist id="tracked-exams">
                  {sortedExamOptions.map((exam) => (
                    <option key={exam.id} value={exam.label} />
                  ))}
                </datalist>
              </div>
              <button
                type="button"
                onClick={addDateColumn}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-800"
              >
                <CalendarPlus className="h-4 w-4" /> Nueva fecha
              </button>
            </div>
            {examSheets.length > DATE_COLUMNS_PER_PAGE && (
              <div className="mt-3 flex items-center justify-between gap-3 border-t border-indigo-100 pt-3">
                <p className="text-xs font-semibold text-indigo-900">
                  Mostrando fechas {safeVisibleColumnStart + 1}â€“
                  {Math.min(
                    safeVisibleColumnStart + DATE_COLUMNS_PER_PAGE,
                    examSheets.length
                  )} de {examSheets.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={safeVisibleColumnStart === 0}
                    onClick={() =>
                      setVisibleColumnStart((start) => Math.max(0, start - DATE_COLUMNS_PER_PAGE))
                    }
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    â† Anteriores
                  </button>
                  <button
                    type="button"
                    disabled={safeVisibleColumnStart + DATE_COLUMNS_PER_PAGE >= examSheets.length}
                    onClick={() =>
                      setVisibleColumnStart((start) =>
                        Math.min(
                          Math.max(0, examSheets.length - DATE_COLUMNS_PER_PAGE),
                          start + DATE_COLUMNS_PER_PAGE
                        )
                      )
                    }
                    className="rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-xs font-bold text-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Siguientes â†’
                  </button>
                </div>
              </div>
            )}
            {(examSearch || "").trim().length >= 2 && (
              <div className="mt-2 flex flex-wrap gap-1" aria-label="Resultados de exÃ¡menes">
                {sortedExamOptions
                  .filter((exam) =>
                    exam.label.toLocaleLowerCase("es").includes(examSearch.toLocaleLowerCase("es"))
                  )
                  .slice(0, 8)
                  .map((exam) => (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => {
                        addExam(exam.id);
                        setExamSearch("");
                      }}
                      className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200 hover:bg-indigo-100"
                    >
                      + {exam.label}
                    </button>
                  ))}
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={customExamName}
                placeholder="Examen no listado, tal como aparece en el informe"
                className="min-w-0 flex-1 rounded-xl border border-indigo-200 bg-white p-2.5 text-sm text-slate-700"
                onChange={(event) => setCustomExamName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustomExam();
                  }
                }}
              />
              <button
                type="button"
                onClick={addCustomExam}
                className="rounded-xl border border-indigo-300 bg-white px-4 text-sm font-bold text-indigo-800 hover:bg-indigo-100"
              >
                Agregar fila
              </button>
            </div>
          </div>

          {examSheets.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 py-10 text-center text-slate-500">
              Agregue una fecha o un examen para iniciar el seguimiento.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-56 border-b border-r border-slate-200 bg-slate-50 p-3 font-bold">
                      Examen
                    </th>
                    {visibleSheets.map((sheet) => (
                      <th
                        key={sheet.id}
                        className="min-w-44 border-b border-r border-slate-200 p-3 align-top"
                      >
                        <div className="flex items-center gap-1">
                          <input
                            aria-label={`Fecha de exÃ¡menes ${sheet.id}`}
                            type="date"
                            value={sheet.date}
                            onChange={(event) =>
                              updateSheet(sheet.id, { date: event.target.value })
                            }
                            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-700"
                          />
                          <button
                            type="button"
                            aria-label={`Eliminar fecha ${sheet.date}`}
                            title="Eliminar fecha"
                            onClick={() => removeDateColumn(sheet.id)}
                            className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedColumnId((previous) =>
                              previous === sheet.id ? null : sheet.id
                            )
                          }
                          className="mt-2 text-xs font-semibold text-indigo-700 hover:underline"
                        >
                          {expandedColumnId === sheet.id ? "Ocultar detalles" : "Origen / detalles"}
                        </button>
                        {expandedColumnId === sheet.id && (
                          <div className="mt-2 space-y-2 rounded-lg bg-white p-2 ring-1 ring-slate-200">
                            <select
                              aria-label={`Procedencia ${sheet.date}`}
                              value={sheet.source || "patient_provided"}
                              onChange={(event) =>
                                updateSheet(sheet.id, {
                                  source: event.target.value as ExamSheet["source"],
                                })
                              }
                              className="w-full rounded border border-slate-200 p-1.5 text-xs"
                            >
                              <option value="patient_provided">Aportado por paciente</option>
                              <option value="laboratory_report">Informe laboratorio</option>
                              <option value="other">Otra procedencia</option>
                            </select>
                            <input
                              value={sheet.sourceDetails || ""}
                              onChange={(event) =>
                                updateSheet(sheet.id, { sourceDetails: event.target.value })
                              }
                              placeholder="Laboratorio / nota"
                              className="w-full rounded border border-slate-200 p-1.5 text-xs"
                            />
                          </div>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {examIds.length === 0 ? (
                    <tr>
                      <td
                        colSpan={visibleSheets.length + 1}
                        className="p-8 text-center text-slate-500"
                      >
                        AÃ±ada exÃ¡menes usando el buscador, un perfil o un nombre libre.
                      </td>
                    </tr>
                  ) : (
                    examIds.map((examId) => {
                      const history = getExamHistory(examId);
                      const trendOpen = trendExamId === examId;
                      return (
                        <React.Fragment key={examId}>
                          <tr className="hover:bg-slate-50/70">
                            <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white p-3 text-left align-top">
                              <div className="flex items-start justify-between gap-2">
                                <span>
                                  <span className="block font-bold text-slate-800">
                                    {getLabel(examId)}
                                  </span>
                                  {getUnit(examId) && (
                                    <span className="text-xs font-medium text-slate-400">
                                      {getUnit(examId)}
                                    </span>
                                  )}
                                </span>
                                <div className="flex gap-1">
                                  {history.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => setTrendExamId(trendOpen ? null : examId)}
                                      className="rounded px-1.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-50"
                                    >
                                      EvoluciÃ³n
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    aria-label={`Eliminar fila ${getLabel(examId)}`}
                                    onClick={() => removeExamRow(examId)}
                                    className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </th>
                            {visibleSheets.map((sheet) => (
                              <td key={sheet.id} className="border-b border-r border-slate-200 p-2">
                                <input
                                  aria-label={`${getLabel(examId)} ${sheet.date}`}
                                  value={sheet.exams[examId] || ""}
                                  onChange={(event) =>
                                    setExamValue(sheet.id, examId, event.target.value)
                                  }
                                  placeholder="â€”"
                                  className="w-full min-w-28 rounded-lg border border-transparent bg-slate-50 px-3 py-2 text-center font-bold text-slate-800 outline-none focus:border-indigo-400 focus:bg-white"
                                />
                              </td>
                            ))}
                          </tr>
                          {trendOpen && (
                            <tr>
                              <td
                                colSpan={visibleSheets.length + 1}
                                className="border-b border-slate-200 bg-indigo-50/60 p-4"
                              >
                                <MiniTrendChart
                                  data={history}
                                  unit={getUnit(examId)}
                                  label={getLabel(examId)}
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
