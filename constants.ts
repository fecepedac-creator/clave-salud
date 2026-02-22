// --- ROLE CATALOG (IDs estables + labels UI) ---
export const ROLE_CATALOG = [
  { id: "ADMIN_CENTRO", label: "Administrador del Centro" },
  { id: "ADMINISTRATIVO", label: "Administrativo (Secretaría)" },

  { id: "MEDICO", label: "Médico" },
  { id: "ENFERMERA", label: "Enfermera" },
  { id: "TENS", label: "TENS (Técnico en Enfermería)" },

  { id: "NUTRICIONISTA", label: "Nutricionista" },
  { id: "PSICOLOGO", label: "Psicólogo" },
  { id: "KINESIOLOGO", label: "Kinesiólogo" },
  { id: "TERAPEUTA_OCUPACIONAL", label: "Terapeuta Ocupacional" },
  { id: "FONOAUDIOLOGO", label: "Fonoaudiólogo" },
  { id: "PODOLOGO", label: "Podólogo" },
  { id: "TECNOLOGO_MEDICO", label: "Tecnólogo Médico" },
  { id: "ASISTENTE_SOCIAL", label: "Asistente Social" },
  { id: "PREPARADOR_FISICO", label: "Preparador Físico" },

  { id: "MATRONA", label: "Matrona" },
  { id: "ODONTOLOGO", label: "Odontólogo" },
  { id: "QUIMICO_FARMACEUTICO", label: "Químico Farmacéutico" },
] as const;

import { Patient, Doctor, ClinicalTemplate, MedicalCenter } from "./types";

// --- CORPORATE IDENTITY ---
// Vectorized version of the Blue/Green Snake & Staff Logo + "ClaveSalud" Text
export const CORPORATE_LOGO = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 350 100" fill="none"><defs><linearGradient id="snakeGrad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="%231e40af" /><stop offset="100%" stop-color="%234ade80" /></linearGradient><linearGradient id="staffGrad" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0%" stop-color="%233b82f6" /><stop offset="100%" stop-color="%231d4ed8" /></linearGradient><linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="%230ea5e9" /><stop offset="100%" stop-color="%230f766e" /></linearGradient></defs><!-- Icon Container --><g transform="translate(10, 5) scale(0.9)"><!-- Staff --><rect x="46" y="10" width="8" height="85" rx="4" fill="url(%23staffGrad)" /><!-- Snake Body --><path d="M48 85 C 15 85 15 60 50 55 C 85 50 85 25 50 20 L 54 20" stroke="url(%23snakeGrad)" stroke-width="10" stroke-linecap="round" fill="none"/><circle cx="56" cy="20" r="6" fill="%234ade80" /></g><!-- Text Logo --><text x="100" y="50" font-family="sans-serif" font-weight="800" font-size="38" fill="%230ea5e9">Clave</text><text x="208" y="50" font-family="sans-serif" font-weight="800" font-size="38" fill="%230f766e">Salud</text><!-- Slogan --><text x="102" y="75" font-family="sans-serif" font-weight="500" font-size="12" fill="%2364748b">Ficha clínica digital para equipos de salud.</text></svg>`;

export const TRACKED_EXAMS_OPTIONS = [
  { id: "hba1c", label: "Hemoglobina Glicosilada (HbA1c)", unit: "%", category: "Metabólico" },
  { id: "creatinina", label: "Creatinina Plasmática", unit: "mg/dL", category: "Renal" },
  { id: "vfg", label: "VFG (MDRD Estimada)", unit: "mL/min", category: "Renal", readOnly: true }, // Calculated
  { id: "tsh", label: "TSH", unit: "uUI/mL", category: "Tiroides" },
  { id: "t4l", label: "T4 Libre", unit: "ng/dL", category: "Tiroides" },
  { id: "vef1", label: "VEF-1 (Espirometría)", unit: "L", category: "Respiratorio" },
  { id: "dlco", label: "DLCO", unit: "%", category: "Respiratorio" },
  { id: "caminata", label: "Test Caminata 6min", unit: "mts", category: "Respiratorio" },
  { id: "microalb", label: "Microalbuminuria", unit: "mg/g", category: "Renal" },
];

export const EXAM_PROFILES = [
  {
    id: "p_renal",
    label: "Perfil Renal",
    exams: ["creatinina", "microalb"],
    description: "Monitoreo de función renal y daño glomerular.",
  },
  {
    id: "p_metabolico",
    label: "Perfil Diabético / Metabólico",
    exams: ["hba1c", "creatinina"],
    description: "Control glucémico y prevención de daño orgánico.",
  },
  {
    id: "p_tiroides",
    label: "Perfil Tiroideo",
    exams: ["tsh", "t4l"],
    description: "Evaluación de función tiroidea.",
  },
  {
    id: "p_resp",
    label: "Perfil Respiratorio (EPOC)",
    exams: ["vef1", "dlco", "caminata"],
    description: "Seguimiento de capacidad pulmonar funcional.",
  },
];

// --- INITIAL CENTERS (MOCK DB) ---
export const INITIAL_CENTERS: MedicalCenter[] = [
  {
    id: "c_saludmass",
    slug: "saludmass",
    name: "SaludMass Centro Médico",
    logoUrl: "", // Empty means it will assume corporate style or fallback icon inside the card, but header uses corporate
    primaryColor: "teal",
    createdAt: "2023-01-01",
    isActive: true,
    isPinned: true,
    maxUsers: 10,
    allowedRoles: [
      "MEDICO",
      "ENFERMERA",
      "KINESIOLOGO",
      "PSICOLOGO",
      "ODONTOLOGO",
      "MATRONA",
      "TERAPEUTA_OCUPACIONAL",
      "PODOLOGO",
      "NUTRICIONISTA",
      "FONOAUDIOLOGO",
    ],
    modules: { dental: true, prescriptions: true, agenda: true },
    features: { anthropometryEnabled: false },
    legalInfo: {
      rut: "76.123.456-7",
      representativeName: "Dr. Felipe Cepeda",
      representativePhone: "+56912345678",
      email: "finanzas@saludmass.cl",
      address: "Av. Libertador 123, Talca",
    },
    subscription: {
      planName: "Plan Full",
      price: 5,
      currency: "UF",
      lastPaymentDate: "2023-10-05",
      status: "active",
    },
  },
  {
    id: "c_dentalpro",
    slug: "dentalpro",
    name: "Clínica Dental Pro",
    logoUrl: "Smile",
    primaryColor: "blue",
    createdAt: "2023-05-15",
    isActive: true,
    isPinned: false,
    maxUsers: 5,
    allowedRoles: ["ODONTOLOGO", "ENFERMERA"], // Only Dental roles
    modules: { dental: true, prescriptions: true, agenda: true },
    features: { anthropometryEnabled: false },
    legalInfo: {
      rut: "77.999.888-K",
      representativeName: "Dra. Ana Molar",
      representativePhone: "+56987654321",
      email: "pagos@dentalpro.cl",
      address: "Calle Uno 456, Curicó",
    },
    subscription: {
      planName: "Plan Básico",
      price: 3,
      currency: "UF",
      lastPaymentDate: "2023-09-01",
      status: "late",
    },
  },
];

export const MEDICAL_HISTORY_OPTIONS = [
  { id: "HTA", label: "Hipertensión Arterial" },
  { id: "DM1", label: "Diabetes Mellitus Tipo 1" },
  { id: "DM2", label: "Diabetes Mellitus Tipo 2" },
  { id: "DLP", label: "Dislipidemia (Colesterol Alto)" },
  { id: "HIPO", label: "Hipotiroidismo" },
  { id: "HIPER", label: "Hipertiroidismo" },
  { id: "ERC", label: "Enfermedad Renal Crónica" },
  { id: "IC", label: "Insuficiencia Cardíaca" },
  { id: "COR", label: "Cardiopatía Coronaria (Infartos)" },
  { id: "ACV", label: "Accidente Cerebrovascular" },
  { id: "EPOC", label: "Asma / EPOC" },
  { id: "CANCER", label: "Cáncer" },
  { id: "OTRO", label: "Otras" },
];

export const SURGICAL_HISTORY_OPTIONS = [
  { id: "APENDICE", label: "Apendicetomía" },
  { id: "VESICULA", label: "Colecistectomía" },
  { id: "HERNIA", label: "Hernias" },
  { id: "UTERO", label: "Histerectomía" },
  { id: "PROSTATA", label: "Cirugía Prostática" },
  { id: "OTRO", label: "Otras" },
];

export const LIVING_WITH_OPTIONS = [
  "Solo/a",
  "Esposo/a o Pareja",
  "Hijos",
  "Padres",
  "Hermanos",
  "Nietos",
  "Abuelos",
  "Sobrinos",
  "Otro",
];

export const MAULE_COMMUNES = [
  "Talca",
  "Curicó",
  "Linares",
  "Cauquenes",
  "Constitución",
  "San Javier",
  "Molina",
  "Parral",
  "Longaví",
  "Teno",
  "Villa Alegre",
  "Rauco",
  "Romeral",
  "Sagrada Familia",
  "Hualañé",
  "Licantén",
  "Curepto",
  "Pencahue",
  "Pelarco",
  "Río Claro",
  "San Clemente",
  "San Rafael",
  "Chanco",
  "Pelluhue",
  "Colbún",
  "Retiro",
  "Yerbas Buenas",
  "Empedrado",
  "Vichuquén",
].sort();

export const COMMON_MEDICATIONS = [
  "Paracetamol 500mg",
  "Ibuprofeno 400mg",
  "Losartán 50mg",
  "Metformina 850mg",
  "Amoxicilina 500mg",
  "Clorfenamina 4mg",
  "Ketorolaco 10mg",
].sort();

export const COMMON_DIAGNOSES = [
  "Hipertensión arterial",
  "Diabetes mellitus 2",
  "Caries dentina",
  "Pulpitis reversible",
  "Lumbago mecánico",
  "Trastorno adaptativo",
  "Gripe",
  "Faringitis aguda",
].sort();

export const DEFAULT_TEMPLATES: ClinicalTemplate[] = [
  // --- MEDICINA GENERAL ---
  {
    id: "med_resfrio",
    title: "Cuadro Gripal / Resfrío",
    content: `INDICACIONES:
1. Reposo relativo x 3 días.
2. Paracetamol 500mg: 1 comprimido cada 8 horas si hay fiebre o dolor.
3. Clorfenamina 4mg: 1 comprimido cada 12 horas x 3 días.
4. Abundante líquido (2 litros al día).
5. Consultar urgencia SOS: Fiebre > 39°C o dificultad respiratoria.`,
    roles: ["MEDICO", "ENFERMERA", "TENS"],
  },
  {
    id: "med_gastro",
    title: "Gastroenteritis Aguda",
    content: `INDICACIONES:
1. Régimen liviano sin residuos (arroz, pollo cocido, jalea) por 48 hrs.
2. Hidratación con Sales de Rehidratación Oral (1 sobre en 1L de agua) o Gatorade.
3. Probióticos: 1 dosis al día x 5 días.
4. Viadil (Pargeverina): 40 gotas cada 8 hrs si hay dolor abdominal.
5. SOS Urgencia: Deshidratación severa o sangre en deposiciones.`,
    roles: ["MEDICO", "ENFERMERA", "TENS"],
  },
  {
    id: "med_hta",
    title: "Control HTA (Hipertensión)",
    content: `PLAN DE MANEJO:
1. Régimen hiposódico (bajo en sal).
2. Caminata 30 min diarios.
3. Losartán 50mg: 1 comprimido cada 12 horas.
4. Control de Presión Arterial seriado en domicilio.
5. Control médico en 1 mes con exámenes.`,
    roles: ["MEDICO"],
  },

  // --- ODONTOLOGÍA ---
  {
    id: "odo_ext_post",
    title: "Indicaciones Post-Extracción",
    content: `CUIDADOS POST EXTRACCIÓN:
1. Morder gasa por 30 minutos (si sangra, cambiar por otra limpia).
2. NO enjuagarse la boca ni escupir por hoy (evita que se salga el coágulo).
3. Dieta blanda y fría por 24 horas (helado, yogurt, jalea).
4. No fumar ni beber alcohol por 3 días.
5. Ibuprofeno 400mg cada 8 horas en caso de dolor.
6. Dormir con cabeza un poco levantada hoy.`,
    roles: ["ODONTOLOGO"],
  },
  {
    id: "odo_higiene",
    title: "Instrucción Higiene Oral",
    content: `INSTRUCCIONES DE HIGIENE:
1. Cepillado 3 veces al día con pasta fluorada (>1450ppm).
2. Uso de seda dental antes de dormir (fundamental entre molares).
3. Disminuir consumo de azúcares y bebidas carbonatadas.
4. Control semestral.`,
    roles: ["ODONTOLOGO", "TENS"], // TENS auxiliar dental
  },
  {
    id: "odo_antibiotico",
    title: "Esquema Antibiótico Infección",
    content: `TRATAMIENTO INFECCIÓN DENTAL:
1. Amoxicilina 500mg: 1 cápsula cada 8 horas por 7 días.
2. Metronidazol 500mg: 1 comprimido cada 8 horas por 7 días.
3. Ketorolaco 10mg: 1 comprimido cada 8 horas por 3 días (solo dolor).
4. Tomar con estómago lleno. No suspender aunque se sienta mejor.`,
    roles: ["ODONTOLOGO"],
  },

  // --- KINESIOLOGÍA ---
  {
    id: "kine_lumbago",
    title: "Pauta Lumbago Mecánico",
    content: `PAUTA DOMICILIARIA (LUMBAGO):
1. Calor local (guatero envuelto) por 20 min en zona lumbar, 2 veces al día.
2. Ejercicio 1: "Lomo de gato" (movilidad suave en 4 apoyos), 3 series de 10.
3. Ejercicio 2: Elongación isquiotibiales (acostado, llevar pierna arriba con toalla), mantener 20 seg x 3 veces.
4. Evitar reposo absoluto en cama; mantener movilidad suave según tolerancia.`,
    roles: ["KINESIOLOGO", "TERAPEUTA_OCUPACIONAL", "PREPARADOR_FISICO"],
  },
  {
    id: "kine_esguince",
    title: "Manejo Esguince Tobillo (RICE)",
    content: `MANEJO INICIAL TOBILLO:
R (Reposo): Evitar carga excesiva por 48 hrs.
I (Hielo): Frio local 15 min cada 4 horas (no directo a piel).
C (Compresión): Vendaje elástico suave si hay edema.
E (Elevación): Pie en alto al estar acostado.
* Iniciar movilidad de dedos inmediatamente.`,
    roles: ["KINESIOLOGO", "PREPARADOR_FISICO"],
  },
  {
    id: "kine_resp",
    title: "KTR Respiratoria Infantil",
    content: `INDICACIONES RESPIRATORIAS:
1. Aseo nasal frecuente con suero fisiológico antes de comer y dormir.
2. Posición semisentada para dormir si hay mucha tos.
3. Inhalador con aerocámara: Agitar, disparar, esperar 10 respiraciones.
4. Signos de Alerta: Hundimiento de costillas, aleteo nasal, labios morados -> URGENCIA.`,
    roles: ["KINESIOLOGO"],
  },

  // --- PSICOLOGÍA ---
  {
    id: "psi_encuadre",
    title: "Encuadre / Consentimiento",
    content: `REGISTRO DE ENCUADRE:
Se explica al paciente:
1. Confidencialidad de la sesión y sus límites legales (riesgo vital propio o terceros).
2. Duración de sesiones (45-60 min) y frecuencia semanal/quincenal.
3. Política de cancelaciones y honorarios.
Paciente firma consentimiento informado y acepta condiciones de terapia.`,
    roles: ["PSICOLOGO"],
  },
  {
    id: "psi_tarea",
    title: "Tarea Cognitiva (Registro)",
    content: `TAREA INTERSESIÓN:
Realizar registro de pensamientos automáticos ante situaciones de ansiedad.
Columnas:
1. Situación (¿Qué pasó?).
2. Emoción (0-10).
3. Pensamiento (¿Qué se me vino a la mente?).
4. Respuesta alternativa (¿Qué otra forma hay de verlo?).`,
    roles: ["PSICOLOGO"],
  },

  // --- PODOLOGÍA ---
  {
    id: "pod_diabetico",
    title: "Cuidado Pie Diabético",
    content: `CUIDADOS PIE DIABÉTICO:
1. Revisar pies diariamente con espejo buscando heridas o roces.
2. Lavar con agua tibia (probar T° con codo) y secar muy bien entre dedos.
3. Humectar piel (crema urea) pero NUNCA entre los dedos.
4. Corte de uñas recto, limar bordes.
5. Usar calcetines sin costuras y calzado ancho.`,
    roles: ["PODOLOGO", "ENFERMERA", "TENS", "MEDICO"],
  },
  {
    id: "pod_onicocriptosis",
    title: "Procedimiento Onicocriptosis",
    content: `PROCEDIMIENTO UÑA ENCARNADA:
1. Asepsia inicial con clorhexidina.
2. Espiculotomía del borde lateral afectado.
3. Limpieza de surco periungueal.
4. Curación con gasa vaselinada y vendaje compresivo.
INDICACIONES:
- No mojar vendaje por 24 horas.
- Usar calzado abierto o amplio.
- Control en 48 horas si hay dolor excesivo.`,
    roles: ["PODOLOGO"],
  },
  {
    id: "pod_heloma",
    title: "Resección de Heloma (Callos)",
    content: `PROCEDIMIENTO:
1. Asepsia de la zona.
2. Deslaminado de hiperqueratosis (bisturí/gubia).
3. Enucleación de heloma.
4. Pulido de la zona.
5. Aplicación de crema humectante.
INDICACIONES:
- Uso de calzado amortiguado.
- Hidratación diaria.`,
    roles: ["PODOLOGO"],
  },

  // --- ENFERMERÍA / TENS ---
  {
    id: "enf_curacion",
    title: "Curación Herida Simple",
    content: `PROTOCOLO CURACIÓN SIMPLE:
1. Retiro de apósito sucio.
2. Irrigación con Suero Fisiológico a chorro.
3. Secado por toques con gasa estéril.
4. Piel circundante limpia y seca.
5. Cobertura con apósito tradicional y fijación.
PRÓXIMA CURACIÓN: En 48 horas o si se mancha/despega.`,
    roles: ["ENFERMERA", "TENS", "MEDICO"],
  },
  {
    id: "enf_csv",
    title: "Control Signos Vitales (EMP)",
    content: `REGISTRO EMPA / CSV:
- Presión Arterial: __/__ mmHg
- Pulso: __ lpm
- SatO2: __ %
- Temperatura: __ °C
- Peso: __ kg / Talla: __ cm
- IMC: __ (Estado: __)
- Circunferencia Cintura: __ cm
CONSEJERÍA BREVE:
- Fomentar actividad física 3 veces/sem.
- Reducir consumo de sal y azúcar.`,
    roles: ["ENFERMERA", "TENS"],
  },
  {
    id: "enf_inyectable",
    title: "Administración IM/SC",
    content: `PROCEDIMIENTO INYECTABLE:
- Medicamento: ________________
- Dosis: ________________
- Vía: [ ] Intramuscular [ ] Subcutánea
- Sitio de punción: Deltoides / Glúteo / Periumbilical
- Asepsia: Alcohol 70%
- Tolerancia: Buena, sin reacciones inmediatas.
INDICACIONES:
- No masajear zona de punción.
- Vigilar sangrado o hematoma.`,
    roles: ["ENFERMERA", "TENS"],
  },

  // --- MATRONA ---
  {
    id: "mat_pap",
    title: "Toma de PAP",
    content: `PROCEDIMIENTO PAPANICOLAOU:
1. Posición de litotomía.
2. Especuloscopía: Cuello uterino visible, sin flujo patológico evidente.
3. Toma de muestra exocervical y endocervical.
4. Fijación de lámina.
INDICACIONES:
- Retiro de resultado en 4 semanas.
- Consultar si presenta sangrado abundante (leve goteo es normal).`,
    roles: ["MATRONA", "MEDICO"],
  },
  {
    id: "mat_prenatal",
    title: "Ingreso Control Prenatal",
    content: `INGRESO PRENATAL:
- FUR: __/__/__  -> FPP: __/__/__
- EG actual: __ semanas.
- Antecedentes Obs: G_ P_ A_
- Examen Físico: Mamas sin nódulos, Utero palpable/no palpable.
- LCF: __ lpm.
SOLICITUD EXÁMENES: Hemograma, VDRL, VIH, Grupo RH, Orina completa, Urocultivo.
INDICACIONES: Ácido Fólico 1mg/día + Calcio + Multivitamínico.`,
    roles: ["MATRONA", "MEDICO"],
  },

  // --- TERAPIA OCUPACIONAL ---
  {
    id: "to_avd",
    title: "Evaluación AVDB",
    content: `EVALUACIÓN ACT. VIDA DIARIA BÁSICAS:
1. Alimentación: Independiente / Requiere asistencia.
2. Higiene Mayor: Independiente / Asistencia para espalda-pies.
3. Vestuario: Dificultad con botones/cierres.
4. Transferencias: Logra bipedestación segura.
PLAN:
- Entrenar uso de abotonador.
- Adaptación de baño (barras de seguridad).`,
    roles: ["TERAPEUTA_OCUPACIONAL"],
  },
  {
    id: "to_cognitivo",
    title: "Estimulación Cognitiva AM",
    content: `SESIÓN COGNITIVA:
OBJETIVO: Mantener atención y memoria de trabajo.
ACTIVIDAD:
1. Orientación temporo-espacial (Fecha, Lugar).
2. Categorización de palabras (Frutas, Animales).
3. Secuencia de números inversa.
OBSERVACIONES: Usuario cooperador, fatiga leve a los 20 min.`,
    roles: ["TERAPEUTA_OCUPACIONAL"],
  },

  // --- FONOAUDIOLOGÍA ---
  {
    id: "flgo_lavado",
    title: "Lavado de Oídos",
    content: `PROCEDIMIENTO LAVADO OÍDOS:
1. Otoscopia previa: Tapón de cerumen obstructivo OI/OD.
2. Irrigación con agua templada.
3. Extracción de tapón íntegro/fragmentado.
4. Secado de conducto.
5. Otoscopia control: Tímpano indemne, visualización clara.
INDICACIONES: Proteger oído del agua por 24 hrs.`,
    roles: ["FONOAUDIOLOGO", "MEDICO", "ENFERMERA"],
  },
  {
    id: "flgo_deglucion",
    title: "Evaluación Deglución",
    content: `EVALUACIÓN CLÍNICA DEGLUCIÓN:
- Control motor oral: Adecuado.
- Reflejo nauseoso: Presente.
- Prueba del vaso (agua):
  - Tos: No
  - Voz húmeda: No
  - Desaturación: No
CONCLUSIÓN: Deglución funcional para líquidos claros.
PLAN: Mantener régimen común, vigilancia en ingesta.`,
    roles: ["FONOAUDIOLOGO"],
  },
  {
    id: "flgo_voz",
    title: "Rehabilitación de Voz",
    content: `SESIÓN VOZ:
EJERCICIOS:
1. Relajación cervical y hombros.
2. Tracto Vocal Semi Ocluido (TVSO): Vibración labial y humming x 3 min.
3. Emisión sostenida /m/ con resonancia anterior.
4. Higiene vocal: Aumentar hidratación, evitargritos y carraspeo.
OBSERVACIONES: Se logra mejor proyección y disminución de tensión laríngea.`,
    roles: ["FONOAUDIOLOGO"],
  },
  {
    id: "flgo_lenguaje",
    title: "Evaluación Lenguaje (Adulto)",
    content: `EVALUACIÓN LENGUAJE:
1. LENGUAJE ESPONTÁNEO: Fluidez [ ] Adecuada [ ] Alterada. Contenido informativo [ ]
2. COMPRENSIÓN:
   - Ordenes simples: Logra/No logra
   - Ordenes complejas: Logra/No logra
3. DENOMINACIÓN:
   - Por confrontación visual: __/10
4. REPETICIÓN: Palabras y frases.
5. LECTOESCRITURA: Conservada/Alterada.
HIPÓTESIS: Trastorno cognitivo-comunicativo leve.`,
    roles: ["FONOAUDIOLOGO"],
  },

  // --- TERAPIA OCUPACIONAL (AMPLIADO) ---
  {
    id: "to_barthel",
    title: "Índice de Barthel (Dependencia)",
    content: `ÍNDICE DE BARTHEL (Puntaje Total: __ / 100):
- Comer (0, 5, 10): __
- Lavarse (0, 5): __
- Vestirse (0, 5, 10): __
- Arreglarse (0, 5): __
- Deposición (0, 5, 10): __
- Micción (0, 5, 10): __
- Ir al retrete (0, 5, 10): __
- Traslado cama/sillón (0, 5, 10, 15): __
- Deambulación (0, 5, 10, 15): __
- Subir/Bajar escaleras (0, 5, 10): __
INTERPRETACIÓN: <20 (Dep. Total), 20-35 (Grave), 40-55 (Moderada), >60 (Leve), 100 (Independiente).`,
    roles: ["TERAPEUTA_OCUPACIONAL", "ENFERMERA", "MEDICO", "KINESIOLOGO"],
  },
  {
    id: "to_minimental",
    title: "Mini-Mental Abreviado (MMSE)",
    content: `MMSE (Puntaje Total: __ / 19):
1. ORIENTACIÓN TEMPORAL (0-5): Mes, Día mes, Año, Día sem, Hora aprox. [__]
2. ORIENTACIÓN ESPACIAL (0-5): Región, Ciudad, Comuna, Lugar, Piso. [__]
3. MEMORIA (0-3): Repetir "Casa, Arbol, Perro". [__]
4. ATENCIÓN/CÁLCULO (0-5): Restar 7 a 100 (5 veces). [__]
5. MEMORIA DIFERIDA (0-3): Recordar palabras anteriores. [__]
6. LENGUAJE: Denominar reloj y lápiz (2), Repetir frase (1), 3 órdenes (3).
INTERPRETACIÓN: <13 puntos sugiere deterioro cognitivo (ajustar por escolaridad).`,
    roles: ["TERAPEUTA_OCUPACIONAL", "MEDICO", "PSICOLOGO", "ENFERMERA"],
  },
  {
    id: "to_cognitivo",
    title: "Estimulación Cognitiva AM",
    content: `SESIÓN COGNITIVA:
OBJETIVO: Mantener atención y memoria de trabajo.
ACTIVIDAD:
1. Orientación temporo-espacial (Fecha, Lugar).
2. Categorización de palabras (Frutas, Animales).
3. Secuencia de números inversa.
OBSERVACIONES: Usuario cooperador, fatiga leve a los 20 min.`,
    roles: ["TERAPEUTA_OCUPACIONAL"],
  },

  // --- PSICOLOGÍA (AMPLIADO) ---
  {
    id: "psi_encuadre",
    title: "Encuadre / Consentimiento",
    content: `REGISTRO DE ENCUADRE:
Se explica al paciente:
1. Confidencialidad de la sesión y sus límites legales (riesgo vital propio o terceros).
2. Duración de sesiones (45-60 min) y frecuencia semanal/quincenal.
3. Política de cancelaciones y honorarios.
Paciente firma consentimiento informado y acepta condiciones de terapia.`,
    roles: ["PSICOLOGO"],
  },
  {
    id: "psi_anamnesis_infantil",
    title: "Anamnesis Infanto-Juvenil",
    content: `ANAMNESIS INFANTO-JUVENIL:
1. MOTIVO DE CONSULTA (Relato padres vs niño):
2. ANTECEDENTES DEL DESARROLLO (Embarazo, parto, hitos motor/lenguaje):
3. CONTEXTO FAMILIAR (Quien vive, dinámica, separaciones):
4. CONTEXTO ESCOLAR (Rendimiento, conducta, bullying):
5. SUEÑO Y ALIMENTACIÓN:
OBSERVACIONES CONDUCTUALES:`,
    roles: ["PSICOLOGO", "TERAPEUTA_OCUPACIONAL", "FONOAUDIOLOGO"],
  },
  {
    id: "psi_tarea",
    title: "Tarea Cognitiva (Registro)",
    content: `TAREA INTERSESIÓN:
Realizar registro de pensamientos automáticos ante situaciones de ansiedad.
Columnas:
1. Situación (¿Qué pasó?).
2. Emoción (0-10).
3. Pensamiento (¿Qué se me vino a la mente?).
4. Respuesta alternativa (¿Qué otra forma hay de verlo?).`,
    roles: ["PSICOLOGO"],
  },
  {
    id: "as_social",
    title: "Informe Social Breve",
    content: `INFORME SOCIAL:
1. GRUPO FAMILIAR: Nuclear / Extensa / Monoparental.
2. SITUACIÓN HABITACIONAL: Propietario / Arrendatario / Allegado. Saneamiento básico: [ ] Sí [ ] No.
3. INGRESOS: Sueldo mínimo / Pensiones / Informal.
4. REDES DE APOYO: Municipalidad, Consultorio, Vecinos.
CONCLUSIÓN SOCIO-ECONÓMICA: Vulnerabilidad leve/moderada/alta.`,
    roles: ["ASISTENTE_SOCIAL"],
  },
  {
    id: "qf_validacion",
    title: "Validación Farmacoterapéutica",
    content: `REVISIÓN MEDICAMENTOS:
1. Conciliación: Medicamentos coinciden con indicación médica.
2. Interacciones detectadas: Ninguna significativa.
3. Adherencia: Paciente reporta olvidos ocasionales.
4. Consejería: Se educa sobre horarios y toma con alimentos.`,
    roles: ["QUIMICO_FARMACEUTICO", "MEDICO"],
  },
  {
    id: "tm_fundus",
    title: "Informe Fondo de Ojo (TM)",
    content: `FONDO DE OJO (NO MIDRIÁTICO):
- OJO DERECHO: Papila bordes netos, excavación fisiológica, mácula conservada, vasos normales.
- OJO IZQUIERDO: Papila bordes netos, sin hemorragias ni exudados.
CONCLUSIÓN: Retinografía normal bilateral.
SUGERENCIA: Control anual.`,
    roles: ["TECNOLOGO_MEDICO"],
  },
  {
    id: "tm_ecografia",
    title: "Informe Ecográfico Básico",
    content: `ECOGRAFÍA RÁPIDA:
- Hígado: Tamaño conservado, ecoestructura homogénea.
- Vía Biliar: Sin litiasis visible.
- Riñones: Conservados, buena diferenciación córtico-medular.
CONCLUSIÓN: Sin hallazgos patológicos evidentes al examen.`,
    roles: ["TECNOLOGO_MEDICO"],
  },
  {
    id: "nut_anamnesis",
    title: "Anamnesis Alimentaria",
    content: `RECORDATORIO 24 HORAS:
- Desayuno:
- Almuerzo:
- Once:
- Cena:
HABITOS:
- Agua: __ vasos/día.
- Alcohol: __
- Preferencias: Dulces / Salados.
DIAGNÓSTICO NUTRICIONAL INTEGRADO: Malnutrición por exceso (Obesidad I).`,
    roles: ["NUTRICIONISTA", "MEDICO", "PREPARADOR_FISICO"],
  },
  {
    id: "nut_pauta",
    title: "Pauta Hipocalórica General",
    content: `PLAN DE ALIMENTACIÓN(HIPOCALÓRICO):
      1. Horarios: Comer cada 3-4 horas(4 comidas + 1 colación).
2. Desayuno / Once: Lácteo descremado + 1 / 2 pan(marraqueta / hallulla) sin miga + agregados bajos en grasa(jamón pavo, quesillo, palta).
3. Almuerzo / Cena: Plato dividido -> 1 / 2 verduras, 1 / 4 proteína(carne / pollo / pescado / huevo), 1 / 4 carbohidrato(arroz / fideos / papa).
4. Líquidos: 2 Litros de agua al día(sin azúcar).
5. Evitar: Frituras, bebidas azucaradas, pastelería.`,
    roles: ["NUTRICIONISTA"],
  },
  {
    id: "nut_diabetica",
    title: "Pauta Diabético",
    content: `PLAN ALIMENTACIÓN DIABETES:
  1. SELECCIÓN DE CARBOHIDRATOS: Preferir integrales(avena, arroz integral) y legumbres.
2. FRUTAS: Máximo 2 porciones al día, evitar jugos naturales(comer la fruta entera).
3. HORARIOS: No saltarse comidas para evitar hipoglicemias.
4. ELIMINAR: Azúcar, miel, mermeladas con azúcar, bebidas normales.Uso de endulzante permitido(Stevia / Sucralosa).
5. VERDURAS: Libre consumo de verduras verdes(lechuga, apio, pepino).`,
    roles: ["NUTRICIONISTA", "MEDICO", "ENFERMERA"],
  },

  // --- PREPARADOR FÍSICO ---
  {
    id: "pf_evaluacion",
    title: "Evaluación Funcional",
    content: `EVALUACIÓN INICIAL:
  - ANTECEDENTES: Lesiones previas, sedentarismo, enfermedades crónicas.
- OBJETIVO: (Bajar peso / Aumentar masa muscular / Salud).
- TEST FÍSICOS:
  1. Sentadilla(fuerza tren inf): __ reps / 30 seg.
  2. Flexo - extensión(fuerza tren sup): __ reps.
  3. Plancha(core): __ segundos.
  4. Flexibilidad(Reach test): __ cm.
PLAN DE ENTRENAMIENTO: Frecuencia 3 veces por semana.`,
    roles: ["PREPARADOR_FISICO"],
  },
  {
    id: "pf_metabolica",
    title: "Pauta Ejercicio Metabólico",
    content: `RUTINA METABÓLICA(Diabetes / Obesidad):
  CALENTAMIENTO: 10 min caminata / bici suave.
PARTE PRINCIPAL(Circuito 3 vueltas):
  1. Sentadilla en silla(15 reps).
2. Empuje pared(brazos)(15 reps).
3. Marcha estática elevando rodillas(1 min).
4. Puente de glúteos(15 reps).
VUELTA A LA CALMA: Elongación general 10 min.
* Mantener hidratación constante.Si siente mareo, detener.`,
    roles: ["PREPARADOR_FISICO", "KINESIOLOGO"],
  },
];

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: "doc1",
    centerId: "c_saludmass",
    rut: "16.459.999-1",
    fullName: "Felipe Cepeda",
    role: "MEDICO",
    specialty: "Medicina Interna",
    university: "U. Católica del Maule",
    email: "medico@saludmass.cl",
    isAdmin: true, // DEFAULT ADMIN
    agendaConfig: { slotDuration: 20, startTime: "16:00", endTime: "20:00" },
  },
  {
    id: "doc2",
    centerId: "c_saludmass",
    rut: "11.222.333-4",
    fullName: "Dra. Ana Molar",
    role: "ODONTOLOGO",
    specialty: "Odontología General",
    university: "U. de Talca",
    email: "dental@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 30, startTime: "09:00", endTime: "13:00" },
  },
  {
    id: "doc3",
    centerId: "c_saludmass",
    rut: "15.555.666-7",
    fullName: "Lic. Pedro Movimiento",
    role: "KINESIOLOGO",
    specialty: "Rehabilitación Musculoesquelética",
    university: "U. Autónoma",
    email: "kine@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 45, startTime: "14:00", endTime: "19:00" },
  },
  {
    id: "doc4",
    centerId: "c_saludmass",
    rut: "13.333.444-5",
    fullName: "Ps. Laura Mente",
    role: "PSICOLOGO",
    specialty: "Psicología Clínica Adulto",
    university: "U. de Chile",
    email: "psico@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 60, startTime: "09:00", endTime: "18:00" },
  },
  // --- NEW FAKE PROFESSIONALS ---
  {
    id: "doc5",
    centerId: "c_saludmass",
    rut: "17.888.777-6",
    fullName: "Enf. María Cuidados",
    role: "ENFERMERA",
    specialty: "Curaciones y Procedimientos",
    university: "U. Santo Tomás",
    email: "enfermera@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 20, startTime: "08:00", endTime: "17:00" },
  },
  {
    id: "doc6",
    centerId: "c_saludmass",
    rut: "18.999.000-K",
    fullName: "Mat. Sofia Parto",
    role: "MATRONA",
    specialty: "Ginecología y Obstetricia",
    university: "U. de Concepción",
    email: "matrona@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 30, startTime: "09:00", endTime: "18:00" },
  },
  {
    id: "doc7",
    centerId: "c_saludmass",
    rut: "14.111.222-3",
    fullName: "TO. Carlos Manos",
    role: "TERAPEUTA_OCUPACIONAL",
    specialty: "Rehabilitación Física Adulto",
    university: "U. Mayor",
    email: "to@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 45, startTime: "10:00", endTime: "19:00" },
  },
  {
    id: "doc8",
    centerId: "c_saludmass",
    rut: "10.555.444-8",
    fullName: "Pod. Roberto Pies",
    role: "PODOLOGO",
    specialty: "Podología Clínica",
    university: "CFT San Agustín",
    email: "podologo@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 30, startTime: "09:00", endTime: "13:00" },
  },
  {
    id: "doc9",
    centerId: "c_saludmass",
    rut: "19.222.111-9",
    fullName: "Flga. Clara Sonido",
    role: "FONOAUDIOLOGO",
    specialty: "Audiología y Voz",
    university: "U. de Talca",
    email: "fono@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 30, startTime: "14:00", endTime: "20:00" },
  },
  {
    id: "doc10",
    centerId: "c_saludmass",
    rut: "16.777.333-2",
    fullName: "Nut. Vitalia Salud",
    role: "NUTRICIONISTA",
    specialty: "Nutrición Deportiva y Obesidad",
    university: "U. del Desarrollo",
    email: "nutri@saludmass.cl",
    isAdmin: false,
    agendaConfig: { slotDuration: 30, startTime: "08:00", endTime: "14:00" },
  },
];

export const MOCK_PATIENTS: Patient[] = [
  {
    id: "1",
    centerId: "c_saludmass",
    rut: "12.345.678-9",
    fullName: "Juan Pérez González",
    birthDate: "1960-05-15",
    gender: "Masculino",
    email: "juan.perez@email.com",
    phone: "+56912345678",
    address: "Av. Siempre Viva 123",
    commune: "San Javier",
    occupation: "Profesor Jubilado",
    livingWith: ["Esposo/a o Pareja"],
    medicalHistory: ["HTA", "DM2"],
    surgicalHistory: [],
    smokingStatus: "Ex fumador",
    alcoholStatus: "Ocasional",
    medications: [{ id: "m1", name: "Losartán", dose: "50mg", frequency: "Cada 12 hrs" }],
    allergies: [],
    consultations: [],
    attachments: [],
    lastUpdated: "2023-10-15T10:00:00",
    activeExams: ["creatinina", "hba1c"],
    active: true,
  },
];
