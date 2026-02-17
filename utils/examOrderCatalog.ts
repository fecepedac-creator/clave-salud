export type ExamOrderCategory =
  | "lab_general"
  | "inmuno"
  | "cardio"
  | "pulmonar"
  | "imagenes";

export type ExamOrderItem = {
  label: string;
  code?: string;
  modality?: "RX" | "TC" | "RM" | "ECO" | null;
  contrast?: "con" | "sin" | null;
};

export type ExamOrderGroup = {
  id: string;
  label: string;
  items: ExamOrderItem[];
};

export type ExamOrderCategoryTemplate = {
  id: ExamOrderCategory;
  label: string;
  groups: ExamOrderGroup[];
};

export type ExamOrderCatalog = {
  version: number;
  categories: ExamOrderCategoryTemplate[];
};

export const EXAM_ORDER_CATEGORY_LABELS: Record<ExamOrderCategory, string> = {
  lab_general: "Laboratorio",
  inmuno: "Inmunológicos",
  cardio: "Cardiológicos",
  pulmonar: "Función pulmonar",
  imagenes: "Imágenes",
};

export const DEFAULT_EXAM_ORDER_CATALOG: ExamOrderCatalog = {
  version: 1,
  categories: [
    {
      id: "lab_general",
      label: "Laboratorio clínico general",
      groups: [
        { id: "bioquimica", label: "Bioquímica", items: [{ label: "Perfil bioquímico" }, { label: "Creatinina" }, { label: "Perfil lipídico" }] },
        { id: "endocrino", label: "Endocrino", items: [{ label: "TSH" }, { label: "T4 Libre" }, { label: "HbA1c" }] },
        { id: "hematologia", label: "Hematología", items: [{ label: "Hemograma" }, { label: "Ferritina" }] },
        { id: "microbiologia", label: "Microbiología", items: [{ label: "Urocultivo" }, { label: "Cultivo de secreción" }] },
      ],
    },
    {
      id: "inmuno",
      label: "Inmunológicos / Reumatológicos",
      groups: [
        { id: "les", label: "Perfil LES", items: [{ label: "ANA" }, { label: "Anti-DNA" }, { label: "C3/C4" }] },
        { id: "saf", label: "Perfil SAF", items: [{ label: "Anticoagulante lúpico" }, { label: "Anticardiolipinas" }, { label: "Anti beta-2 glicoproteína" }] },
        { id: "vasculitis", label: "Perfil Vasculitis", items: [{ label: "ANCA" }, { label: "PR3/MPO" }] },
      ],
    },
    {
      id: "cardio",
      label: "Cardiológicos",
      groups: [
        {
          id: "cardio_estudios",
          label: "Estudios cardiológicos",
          items: [
            { label: "ECG" },
            { label: "Ecocardiograma" },
            { label: "Holter 24h" },
            { label: "MAPA" },
            { label: "Test de esfuerzo" },
          ],
        },
      ],
    },
    {
      id: "pulmonar",
      label: "Función pulmonar",
      groups: [
        {
          id: "funcion_pulmonar",
          label: "Pruebas respiratorias",
          items: [
            { label: "Espirometría" },
            { label: "DLCO" },
            { label: "Caminata 6 minutos" },
          ],
        },
      ],
    },
    {
      id: "imagenes",
      label: "Imágenes",
      groups: [
        {
          id: "imagenes_generales",
          label: "Imagenología",
          items: [
            { label: "Radiografía", modality: "RX" },
            { label: "Tomografía computada", modality: "TC", contrast: "sin" },
            { label: "Resonancia magnética", modality: "RM", contrast: "sin" },
            { label: "Ecografía", modality: "ECO" },
          ],
        },
      ],
    },
  ],
};

export function getCategoryLabel(category: ExamOrderCategory): string {
  return EXAM_ORDER_CATEGORY_LABELS[category] || category;
}
