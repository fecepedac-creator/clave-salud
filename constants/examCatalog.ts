
export interface ExamGroup {
    label: string;
    items: string[];
}

export interface ExamModule {
    id: string;
    label: string;
    groups: ExamGroup[];
}

export interface QuickProfile {
    id: string;
    label: string;
    exams: string[];
}

export const EXAM_MODULES: ExamModule[] = [
    {
        id: "general",
        label: "Generales",
        groups: [
            {
                label: "Bioquímicos",
                items: [
                    "BUN",
                    "Creatinina",
                    "Glicemia",
                    "Perfil Hepático",
                    "ELP (Electrolitos Plasmáticos)",
                    "Perfil Lipídico",
                    "Proteínas Totales y Albúmina",
                    "Ácido Úrico",
                    "Calcio",
                    "Fósforo",
                    "Magnesio",
                    "Hemoglobina Glicosilada (HbA1c)",
                    "Insulina Basal",
                ],
            },
            {
                label: "Hematológicos",
                items: [
                    "Hemograma",
                    "VHS",
                    "Tiempo de Protrombina (INR)",
                    "TTPK",
                    "Ferritina",
                    "Vitamin B12",
                    "Ácido Fólico",
                ],
            },
            {
                label: "Orina / Renal",
                items: [
                    "Orina Completa",
                    "Urocultivo + Antibiograma",
                    "Razón Albúmina/Creatinina (RAC)",
                    "Sedimento Urinario",
                ],
            },
            {
                label: "Inmunológicos / Otros",
                items: [
                    "Proteína C Reactiva (PCR to)",
                    "Factor Reumatoideo",
                    "TSH",
                    "T4 Libre",
                    "Vitamina D (25-OH)",
                ],
            },
        ],
    },
    {
        id: "cardio",
        label: "Cardiológicos",
        groups: [
            {
                label: "Exámenes",
                items: [
                    "Electrocardiograma (ECG)",
                    "Test de Esfuerzo",
                    "Ecocardiograma Doppler",
                    "Holter de Ritmo (24h)",
                    "Holter de Presión (MAPA)",
                    "AngioTC Coronario",
                    "Cintigrama Miocárdico",
                ],
            },
        ],
    },
    {
        id: "reuma",
        label: "Reumatológicos",
        groups: [
            {
                label: "Autoanticuerpos y Perfiles",
                items: [
                    "ANA (Antinucleares)",
                    "ENA (Perfil Extractable)",
                    "ANCA (p-ANCA, c-ANCA)",
                    "Anti-DNA",
                    "Complemento C3 y C4",
                    "Perfil Hepatitis Autoinmune (ANA, ASMA, LKM-1)",
                    "Perfil Miositis",
                    "Ac. Anti Citrulina (CCP)",
                    "HLA-B27",
                ],
            },
        ],
    },
    {
        id: "respi",
        label: "Respiratorios",
        groups: [
            {
                label: "Funcionalidad e Imagen",
                items: [
                    "Espirometría Basal",
                    "Espirometría con Broncodilatador",
                    "Test de Difusión (DLCO)",
                    "Test de Caminata 6 minutos",
                    "Cintigrama V/Q",
                    "Polisomnografía",
                ],
            },
        ],
    },
    {
        id: "imagen",
        label: "Imagenología",
        groups: [
            {
                label: "Radiografías (Rx)",
                items: [
                    "Rx Tórax AP/L",
                    "Rx Columna Cervical",
                    "Rx Columna Lumbar",
                    "Rx Pelvis",
                    "Rx Rodilla",
                    "Rx Hombro",
                    "Rx Mano",
                    "Rx Abdomen Simple",
                ],
            },
            {
                label: "Ecografías",
                items: [
                    "Eco Abdominal",
                    "Eco Renal/Vesical",
                    "Eco Pelviana",
                    "Eco Mamaria",
                    "Eco Tiroidea",
                    "Eco Doppler Carotídeo",
                    "Eco Doppler Venoso EEII",
                ],
            },
            {
                label: "Tomografía (TC/Scanner)",
                items: [
                    "TC Cerebro",
                    "TC Tórax",
                    "TC Abdomen y Pelvis",
                    "TC Columna Lumbar",
                    "UroTAC",
                ],
            },
            {
                label: "Resonancia (RNM)",
                items: [
                    "RNM Cerebro",
                    "RNM Columna Cervical",
                    "RNM Columna Lumbar",
                    "RNM Rodilla",
                    "RNM Hombro",
                ],
            },
        ],
    },
];

export const QUICK_PROFILES: QuickProfile[] = [
    {
        id: "cv_dm",
        label: "Control Cardiovascular (Diabetes)",
        exams: [
            "BUN",
            "Creatinina",
            "ELP (Electrolitos Plasmáticos)",
            "Hemoglobina Glicosilada (HbA1c)",
            "Hemograma",
            "Orina Completa",
            "Razón Albúmina/Creatinina (RAC)",
            "Perfil Lipídico",
            "Perfil Hepático",
        ],
    },
    {
        id: "cv_no_dm",
        label: "Cardiovascular (Sin Diabetes)",
        exams: [
            "BUN",
            "Creatinina",
            "ELP (Electrolitos Plasmáticos)",
            "Hemograma",
            "Orina Completa",
            "Razón Albúmina/Creatinina (RAC)",
            "Perfil Lipídico",
            "Perfil Hepático",
        ],
    },
    {
        id: "preop",
        label: "Preoperatorio",
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
];
