export type ExamOrderCategory =
  | "lab_general"
  | "inmuno"
  | "cardio"
  | "pulmonar"
  | "imagenes"
  | "reuma";

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

export type ExamOrderProfile = {
  id: string;
  label: string;
  description?: string;
  exams: string[];
};

export type ExamOrderCatalog = {
  version: number;
  profiles?: ExamOrderProfile[];
  categories: ExamOrderCategoryTemplate[];
};

export const EXAM_ORDER_CATEGORY_LABELS: Record<string, string> = {
  lab_general: "Laboratorio",
  inmuno: "Inmunológicos",
  cardio: "Cardiológicos",
  pulmonar: "Función pulmonar",
  imagenes: "Imágenes",
  reuma: "Reumatológicos",
};

export const DEFAULT_EXAM_ORDER_CATALOG: ExamOrderCatalog = {
  version: 2,
  profiles: [
    {
      id: "p_cv_dm",
      label: "Control Cardiovascular (Diabetes)",
      description: "Incluye Hemograma, Perfil Lipídico, HbA1c, RAC y Bioquímica renal.",
      exams: [
        "Hemograma",
        "BUN",
        "Creatinina",
        "Electrolitos Plasmáticos (ELP)",
        "Orina Completa",
        "Razón Albúmina/Creatinina (RAC)",
        "Hemoglobina Glicosilada (HbA1c)",
        "Glicemia",
        "Perfil Lipídico",
      ],
    },
    {
      id: "p_preop",
      label: "Preoperatorio General",
      description: "Pruebas básicas para cirugía menor/mayor.",
      exams: [
        "Hemograma",
        "BUN",
        "Creatinina",
        "Glicemia",
        "Orina Completa",
        "Tiempo de Protrombina (INR)",
        "TTPK",
        "Electrocardiograma (ECG)",
      ],
    },
  ],
  categories: [
    {
      id: "lab_general",
      label: "Laboratorio Clínico",
      groups: [
        {
          id: "bioquimica",
          label: "Bioquímicos",
          items: [
            { label: "Perfil Bioquímico" },
            { label: "BUN" },
            { label: "Creatinina" },
            { label: "Glicemia" },
            { label: "Perfil Hepático" },
            { label: "Electrolitos Plasmáticos (ELP)" },
            { label: "Perfil Lipídico" },
            { label: "Proteínas Totales y Albúmina" },
            { label: "Ácido Úrico" },
            { label: "Calcio" },
            { label: "Fósforo" },
            { label: "Magnesio" },
            { label: "Hemoglobina Glicosilada (HbA1c)" },
            { label: "Insulina Basal" },
          ],
        },
        {
          id: "hematologia",
          label: "Hematológicos",
          items: [
            { label: "Hemograma" },
            { label: "VHS" },
            { label: "Tiempo de Protrombina (INR)" },
            { label: "TTPK" },
            { label: "Ferritina" },
            { label: "Vitamina B12" },
            { label: "Ácido Fólico" },
          ],
        },
        {
          id: "orina",
          label: "Orina / Renal",
          items: [
            { label: "Orina Completa" },
            { label: "Urocultivo + Antibiograma" },
            { label: "Razón Albúmina/Creatinina (RAC)" },
            { label: "Sedimento Urinario" },
          ],
        },
        {
          id: "microbiologia",
          label: "Microbiología",
          items: [
            { label: "Cultivo de secreción" },
            { label: "Coprocultivo" },
            { label: "PCR para COVID-19 / Influenza" },
          ],
        },
      ],
    },
    {
      id: "reuma",
      label: "Inmunológicos / Reumatología",
      groups: [
        {
          id: "autoanticuerpos",
          label: "Autoanticuerpos y Perfiles",
          items: [
            { label: "ANA (Antinucleares)" },
            { label: "ENA (Perfil Extractable)" },
            { label: "ANCA (p-ANCA, c-ANCA)" },
            { label: "Anti-DNA" },
            { label: "Complemento C3 y C4" },
            { label: "Ac. Anti Citrulina (CCP)" },
            { label: "HLA-B27" },
            { label: "Factor Reumatoideo" },
            { label: "Proteína C Reactiva (PCR to)" },
          ],
        },
      ],
    },
    {
      id: "cardio",
      label: "Cardiología",
      groups: [
        {
          id: "cardio_estudios",
          label: "Estudios Cardiológicos",
          items: [
            { label: "Electrocardiograma (ECG)" },
            { label: "Test de Esfuerzo" },
            { label: "Ecocardiograma Doppler" },
            { label: "Holter de Ritmo (24h)" },
            { label: "Holter de Presión (MAPA)" },
            { label: "AngioTC Coronario" },
            { label: "Cintigrama Miocárdico" },
          ],
        },
      ],
    },
    {
      id: "pulmonar",
      label: "Respiratorio / Función Pulmonar",
      groups: [
        {
          id: "funcion_pulmonar",
          label: "Pruebas Funcionales",
          items: [
            { label: "Espirometría Basal" },
            { label: "Espirometría con Broncodilatador" },
            { label: "Test de Difusión (DLCO)" },
            { label: "Test de Caminata 6 minutos" },
            { label: "Polisomnografía" },
          ],
        },
      ],
    },
    {
      id: "imagenes",
      label: "Imagenología",
      groups: [
        {
          id: "rx",
          label: "Radiografías (Rx)",
          items: [
            { label: "Rx Tórax AP/L", modality: "RX" },
            { label: "Rx Columna Cervical", modality: "RX" },
            { label: "Rx Columna Lumbar", modality: "RX" },
            { label: "Rx Pelvis", modality: "RX" },
            { label: "Rx Rodilla", modality: "RX" },
            { label: "Rx Hombro", modality: "RX" },
            { label: "Rx Mano", modality: "RX" },
            { label: "Rx Abdomen Simple", modality: "RX" },
          ],
        },
        {
          id: "eco",
          label: "Ecografías",
          items: [
            { label: "Eco Abdominal", modality: "ECO" },
            { label: "Eco Renal/Vesical", modality: "ECO" },
            { label: "Eco Pelviana", modality: "ECO" },
            { label: "Eco Mamaria", modality: "ECO" },
            { label: "Eco Tiroidea", modality: "ECO" },
            { label: "Eco Doppler Venoso EEII", modality: "ECO" },
          ],
        },
        {
          id: "tc",
          label: "Tomografía (TC/Scanner)",
          items: [
            { label: "TC Cerebro", modality: "TC", contrast: "sin" },
            { label: "TC Tórax", modality: "TC", contrast: "sin" },
            { label: "TC Abdomen y Pelvis", modality: "TC", contrast: "sin" },
            { label: "TC Columna Lumbar", modality: "TC", contrast: "sin" },
            { label: "UroTAC", modality: "TC", contrast: "con" },
          ],
        },
        {
          id: "rm",
          label: "Resonancia (RNM)",
          items: [
            { label: "RNM Cerebro", modality: "RM", contrast: "sin" },
            { label: "RNM Columna Cervical", modality: "RM", contrast: "sin" },
            { label: "RNM Columna Lumbar", modality: "RM", contrast: "sin" },
            { label: "RNM Rodilla", modality: "RM", contrast: "sin" },
            { label: "RNM Hombro", modality: "RM", contrast: "sin" },
          ],
        },
      ],
    },
  ],
};

export function getCategoryLabel(category: string): string {
  return EXAM_ORDER_CATEGORY_LABELS[category] || category;
}
