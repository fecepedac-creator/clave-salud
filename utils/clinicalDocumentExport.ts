import type { Consultation, MedicalCenter, Patient } from "../types";

type GeneratedBy = {
  name: string;
  rut?: string;
  role?: string;
  registry?: string;
};

type ClinicalReportWordInput = {
  patient: Patient;
  centerName: string;
  professional: GeneratedBy;
  objective: string;
  dateRange: string;
  content: string;
};

const COLORS = {
  navy: "17233A",
  blue: "2563EB",
  green: "059669",
  ink: "1E293B",
  muted: "64748B",
  line: "CBD5E1",
  soft: "F1F5F9",
  warning: "FFF7ED",
  warningInk: "9A3412",
  allergy: "FEF2F2",
  allergyInk: "B91C1C",
};

const safe = (value?: string | null) => value?.trim() || "No registrado";

const formatDate = (value?: string) => {
  if (!value) return "No registrado";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (value?: string) => {
  if (!value) return "No registrado";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-CL");
};

const calculateAge = (birthDate?: string) => {
  if (!birthDate) return "No registrado";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const birth = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "No registrado";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return `${age} años`;
};

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const getDocx = () => import("docx");

const border = (color = COLORS.line, size = 4) => ({
  top: { style: "single" as const, color, size },
  bottom: { style: "single" as const, color, size },
  left: { style: "single" as const, color, size },
  right: { style: "single" as const, color, size },
});

export type FullClinicalRecordWordInput = {
  patient: Patient;
  center: MedicalCenter | null;
  consultations: Consultation[];
  generatedAt: string;
  generatedBy?: GeneratedBy;
};

export async function createFullClinicalRecordWordBlob(input: FullClinicalRecordWordInput) {
  const docx = await getDocx();
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    PageNumber,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    VerticalAlign,
    WidthType,
  } = docx;

  const { patient, center, generatedAt, generatedBy } = input;
  const consultations = [...input.consultations].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const documentId = `CS-FC-${patient.id}-${new Date(generatedAt).getTime()}`;
  const documentFolio = `CS-FC-${new Date(generatedAt).getTime().toString(36).toUpperCase()}`;

  const noBorder = {
    style: BorderStyle.NONE,
    color: "FFFFFF",
    size: 0,
  };
  const noBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideHorizontal: noBorder,
    insideVertical: noBorder,
  };

  const labelValueCell = (label: string, value: string | string[], width: number) =>
    new TableCell({
      width: { size: width, type: WidthType.DXA },
      verticalAlign: VerticalAlign.CENTER,
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      borders: border(),
      children: [
        new Paragraph({
          spacing: { after: 25 },
          children: [
            new TextRun({ text: label.toUpperCase(), bold: true, size: 16, color: COLORS.muted }),
          ],
        }),
        ...(Array.isArray(value) ? value : [value]).map(
          (line) =>
            new Paragraph({
              spacing: { after: 20 },
              children: [new TextRun({ text: line, size: 20, color: COLORS.ink })],
            })
        ),
      ],
    });

  const sectionTitle = (text: string) =>
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 260, after: 100 },
      keepNext: true,
      children: [new TextRun({ text, bold: true, size: 27, color: COLORS.navy })],
    });

  const field = (label: string, value?: string, keepNext = false) =>
    new Paragraph({
      spacing: { after: 80, line: 276 },
      keepNext,
      children: [
        new TextRun({ text: `${label}: `, bold: true, color: COLORS.ink }),
        new TextRun({ text: safe(value), color: COLORS.ink }),
      ],
    });

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [5600, 3760],
      borders: noBorders,
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 5600, type: WidthType.DXA },
              borders: noBorders,
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: [
                    new TextRun({ text: "CLAVESALUD", bold: true, size: 22, color: COLORS.green }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 60 },
                  children: [
                    new TextRun({
                      text: "FICHA CLÍNICA COMPLETA",
                      bold: true,
                      size: 32,
                      color: COLORS.navy,
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: center?.name || "Centro Médico",
                      size: 20,
                      color: COLORS.muted,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3760, type: WidthType.DXA },
              borders: noBorders,
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `Fecha de emisión: ${formatDateTime(generatedAt)}`,
                      size: 17,
                      color: COLORS.muted,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({
                      text: `Profesional: ${safe(generatedBy?.name)}`,
                      size: 17,
                      color: COLORS.muted,
                    }),
                  ],
                }),
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  children: [
                    new TextRun({ text: `Folio: ${documentFolio}`, size: 16, color: COLORS.muted }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 160, after: 100 }, children: [] }),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [4680, 4680],
      rows: [
        new TableRow({
          children: [
            labelValueCell("Paciente", patient.fullName, 4680),
            labelValueCell("RUT", patient.rut, 4680),
          ],
        }),
        new TableRow({
          children: [
            labelValueCell(
              "Nacimiento / Edad",
              `${formatDate(patient.birthDate)} / ${calculateAge(patient.birthDate)}`,
              4680
            ),
            labelValueCell(
              "Sexo / identidad",
              `${patient.gender} / ${patient.genderIdentity || "No declarada"}`,
              4680
            ),
          ],
        }),
        new TableRow({
          children: [
            labelValueCell(
              "Previsión",
              `${patient.insurance || "No registrada"}${patient.insuranceLevel ? ` (${patient.insuranceLevel})` : ""}`,
              4680
            ),
            labelValueCell(
              "Contacto",
              [
                `Teléfono: ${patient.phone || "No registrado"}`,
                `Correo: ${patient.email || "No registrado"}`,
              ],
              4680
            ),
          ],
        }),
      ],
    }),
    sectionTitle("Resumen clínico"),
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [2340, 7020],
      rows: [
        ["Patologías", patient.medicalHistory?.join(", ") || "No registradas"],
        ["Cirugías", patient.surgicalHistory?.join(", ") || "No registradas"],
        [
          "Alergias",
          patient.allergies?.map((item) => `${item.substance}: ${item.reaction}`).join("; ") ||
            "Sin alergias registradas",
        ],
        [
          "Medicación habitual",
          patient.medications
            ?.map((item) => `${item.name} ${item.dose || ""} ${item.frequency || ""}`.trim())
            .join("; ") || "No registrada",
        ],
      ].map(
        ([label, value], index) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 2340, type: WidthType.DXA },
                shading: {
                  type: ShadingType.CLEAR,
                  fill: index === 2 ? COLORS.allergy : COLORS.soft,
                },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                borders: border(),
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: label,
                        bold: true,
                        color: index === 2 ? COLORS.allergyInk : COLORS.ink,
                      }),
                    ],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 7020, type: WidthType.DXA },
                margins: { top: 100, bottom: 100, left: 140, right: 140 },
                borders: border(),
                children: [
                  new Paragraph({ children: [new TextRun({ text: value, color: COLORS.ink })] }),
                ],
              }),
            ],
          })
      ),
    }),
    sectionTitle(`Historia clínica (${consultations.length} atenciones)`),
  ];

  if (consultations.length === 0) {
    children.push(new Paragraph({ children: [new TextRun("Sin atenciones registradas.")] }));
  }

  consultations.forEach((consultation, index) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        shading: { type: ShadingType.CLEAR, fill: COLORS.soft },
        children: [
          new TextRun({
            text: `${formatDateTime(consultation.date)}  |  ${safe(consultation.professionalName)}`,
            bold: true,
            size: 24,
            color: COLORS.navy,
          }),
        ],
      }),
      field("Motivo de consulta", consultation.reason, true),
      field("Anamnesis próxima", consultation.anamnesis, true),
      field("Examen físico", consultation.physicalExam, true),
      ...(consultation.bloodPressure ||
      consultation.heartRate ||
      consultation.hgt ||
      consultation.weight ||
      consultation.height ||
      consultation.bmi
        ? [
            new Paragraph({
              spacing: { before: 80, after: 70 },
              keepNext: true,
              children: [new TextRun({ text: "Signos vitales", bold: true, color: COLORS.ink })],
            }),
            new Table({
              width: { size: 9360, type: WidthType.DXA },
              layout: TableLayoutType.FIXED,
              columnWidths: [1560, 1560, 1560, 1560, 1560, 1560],
              rows: [
                new TableRow({
                  tableHeader: true,
                  children: ["PA", "FC", "HGT", "Peso", "Talla", "IMC"].map(
                    (label) =>
                      new TableCell({
                        width: { size: 1560, type: WidthType.DXA },
                        shading: { type: ShadingType.CLEAR, fill: COLORS.soft },
                        borders: border(COLORS.line),
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({ text: label, bold: true, color: COLORS.ink })],
                          }),
                        ],
                      })
                  ),
                }),
                new TableRow({
                  children: [
                    consultation.bloodPressure,
                    consultation.heartRate,
                    consultation.hgt,
                    consultation.weight,
                    consultation.height,
                    consultation.bmi,
                  ].map(
                    (value) =>
                      new TableCell({
                        width: { size: 1560, type: WidthType.DXA },
                        borders: border(COLORS.line),
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun(safe(value))],
                          }),
                        ],
                      })
                  ),
                }),
              ],
            }),
          ]
        : []),
      field("Diagnóstico", consultation.diagnosis),
      field(
        "Exámenes",
        consultation.exams && Object.keys(consultation.exams).length
          ? Object.entries(consultation.exams)
              .map(([key, value]) => `${key}: ${value}`)
              .join(" | ")
          : undefined
      ),
      field(
        "Indicaciones, recetas y documentos",
        consultation.prescriptions?.map((item) => `${item.type}: ${item.content}`).join("\n")
      ),
      field(
        "Plan y próximo control",
        consultation.nextControlDate || consultation.nextControlReason
          ? `${formatDate(consultation.nextControlDate)} - ${consultation.nextControlReason || "Motivo no registrado"}`
          : undefined
      )
    );
  });

  children.push(
    new Paragraph({
      spacing: { before: 360, after: 120 },
      border: { top: { style: "single", color: COLORS.navy, size: 8, space: 8 } },
      children: [],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: safe(generatedBy?.name), bold: true, color: COLORS.ink })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: [generatedBy?.role, generatedBy?.rut].filter(Boolean).join(" | "),
          color: COLORS.muted,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 220 },
      shading: { type: ShadingType.CLEAR, fill: COLORS.warning },
      children: [
        new TextRun({
          text: "COPIA EDITABLE DE TRABAJO. Las modificaciones posteriores no alteran el registro clínico almacenado en ClaveSalud.",
          bold: true,
          size: 17,
          color: COLORS.warningInk,
        }),
      ],
    })
  );

  const document = new Document({
    creator: "ClaveSalud",
    title: `Ficha clínica - ${patient.fullName}`,
    description: `Copia editable de trabajo generada desde ClaveSalud. ID interno: ${documentId}`,
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 20, color: COLORS.ink },
          paragraph: { spacing: { after: 100, line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Aptos Display", size: 28, bold: true, color: COLORS.navy },
          paragraph: { spacing: { before: 260, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Aptos Display", size: 24, bold: true, color: COLORS.navy },
          paragraph: { spacing: { before: 180, after: 80 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 560, footer: 560 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "ClaveSalud · Ficha clínica confidencial",
                    size: 16,
                    color: COLORS.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Table({
                width: { size: 8800, type: WidthType.DXA },
                layout: TableLayoutType.FIXED,
                columnWidths: [6200, 2600],
                borders: noBorders,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: 6200, type: WidthType.DXA },
                        borders: noBorders,
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: `Documento clínico confidencial  |  ${documentFolio}`,
                                size: 15,
                                color: COLORS.muted,
                              }),
                            ],
                          }),
                        ],
                      }),
                      new TableCell({
                        width: { size: 2600, type: WidthType.DXA },
                        borders: noBorders,
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({ text: "Página ", size: 15, color: COLORS.muted }),
                              new TextRun({
                                children: [PageNumber.CURRENT],
                                size: 15,
                                color: COLORS.muted,
                              }),
                              new TextRun({ text: " de ", size: 15, color: COLORS.muted }),
                              new TextRun({
                                children: [PageNumber.TOTAL_PAGES],
                                size: 15,
                                color: COLORS.muted,
                              }),
                            ],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}

export async function downloadFullClinicalRecordWord(input: FullClinicalRecordWordInput) {
  const blob = await createFullClinicalRecordWordBlob(input);
  downloadBlob(blob, `ficha-clinica-${slug(input.patient.fullName)}-editable.docx`);
}

export async function downloadClinicalReportWord(input: ClinicalReportWordInput) {
  const docx = await getDocx();
  const {
    AlignmentType,
    Document,
    Footer,
    Header,
    HeadingLevel,
    PageNumber,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableLayoutType,
    TableRow,
    TextRun,
    WidthType,
  } = docx;
  const documentId = `CS-INF-${input.patient.id}-${Date.now()}`;
  const contentParagraphs = input.content.split(/\r?\n/).map((line) => {
    const trimmed = line.trim();
    const numberedHeading = /^\d+\.\s+/.test(trimmed);
    return new Paragraph({
      heading: numberedHeading ? HeadingLevel.HEADING_2 : undefined,
      spacing: { after: trimmed ? 100 : 50, line: 290 },
      children: [new TextRun({ text: trimmed || " ", bold: numberedHeading, color: COLORS.ink })],
    });
  });

  const document = new Document({
    creator: "ClaveSalud",
    title: `Informe clínico - ${input.patient.fullName}`,
    description: "Copia editable de trabajo generada desde ClaveSalud",
    styles: {
      default: {
        document: {
          run: { font: "Aptos", size: 21, color: COLORS.ink },
          paragraph: { spacing: { after: 100, line: 290 } },
        },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Aptos Display", size: 30, bold: true, color: COLORS.navy },
          paragraph: { spacing: { before: 240, after: 120 }, keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: "Aptos Display", size: 24, bold: true, color: COLORS.navy },
          paragraph: { spacing: { before: 180, after: 80 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 560, footer: 560 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `ClaveSalud | ${input.centerName} | Informe clínico`,
                    size: 16,
                    color: COLORS.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: `${documentId}  |  Página `, size: 15, color: COLORS.muted }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: COLORS.muted }),
                  new TextRun({ text: " de ", size: 15, color: COLORS.muted }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 15,
                    color: COLORS.muted,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "CLAVESALUD", bold: true, size: 22, color: COLORS.green }),
            ],
            spacing: { after: 40 },
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "INFORME CLÍNICO", bold: true, color: COLORS.navy })],
          }),
          new Paragraph({
            children: [new TextRun({ text: input.centerName, color: COLORS.muted })],
            spacing: { after: 180 },
          }),
          new Table({
            width: { size: 9360, type: WidthType.DXA },
            layout: TableLayoutType.FIXED,
            columnWidths: [2500, 6860],
            rows: [
              ["Paciente", input.patient.fullName],
              ["RUT", input.patient.rut],
              [
                "Nacimiento / edad",
                `${formatDate(input.patient.birthDate)} / ${calculateAge(input.patient.birthDate)}`,
              ],
              ["Período informado", input.dateRange || "No especificado"],
              ["Objetivo", input.objective || "No especificado"],
            ].map(
              ([label, value]) =>
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 2500, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: COLORS.soft },
                      borders: border(),
                      margins: { top: 100, bottom: 100, left: 140, right: 140 },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: label, bold: true, color: COLORS.ink })],
                        }),
                      ],
                    }),
                    new TableCell({
                      width: { size: 6860, type: WidthType.DXA },
                      borders: border(),
                      margins: { top: 100, bottom: 100, left: 140, right: 140 },
                      children: [
                        new Paragraph({
                          children: [new TextRun({ text: safe(value), color: COLORS.ink })],
                        }),
                      ],
                    }),
                  ],
                })
            ),
          }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: "Contenido clínico", bold: true })],
            spacing: { before: 260, after: 120 },
          }),
          ...contentParagraphs,
          new Paragraph({
            spacing: { before: 400, after: 100 },
            border: { top: { style: "single", color: COLORS.navy, size: 8, space: 8 } },
            children: [],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: input.professional.name, bold: true, color: COLORS.ink }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: [input.professional.role, input.professional.rut, input.professional.registry]
                  .filter(Boolean)
                  .join(" | "),
                color: COLORS.muted,
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 220 },
            shading: { type: ShadingType.CLEAR, fill: COLORS.warning },
            children: [
              new TextRun({
                text: "COPIA EDITABLE DE TRABAJO. Requiere revisión profesional antes de su uso o entrega.",
                bold: true,
                size: 17,
                color: COLORS.warningInk,
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  downloadBlob(blob, `informe-clinico-${slug(input.patient.fullName)}-editable.docx`);
}
