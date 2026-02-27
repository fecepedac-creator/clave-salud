import type { Timestamp } from "firebase/firestore";

/**
 * Representa un valor de fecha compatible con Firestore y Serialización JSON.
 * Se usa para tipar campos que vienen de Firestore como Timestamp pero se
 * transforman a string (ISO) en el frontend, o viceversa.
 */
export type FirestoreDateLike = Timestamp | string | Date | null;

/**
 * Representa un mapa de datos JSON-safe para metadatos o configuraciones dinámicas.
 */
export type JsonValue = string | number | boolean | null | undefined | JsonMap | JsonValue[];
export type JsonMap = { [key: string]: JsonValue };

export interface BrandKit {
  logoUrls?: string[]; // Multiple versions: primary, secondary, icon
  backgroundImages?: string[]; // User uploaded backgrounds
  colors?: {
    primary?: string; // Hex code
    secondary?: string; // Hex code
    accent?: string;
  };
  tagline?: string;
  fontFamily?: string;
}

export interface MedicalCenter {
  id: string;
  slug: string; // For URL: ?center=saludmass
  name: string;
  logoUrl?: string; // Emoji or URL
  primaryColor: string; // Tailwind color name (e.g., 'teal', 'blue', 'indigo')
  createdAt: string;

  // --- SaaS Configuration ---
  isActive: boolean; // If false, access is blocked
  isPinned?: boolean; // To pin important centers to top
  maxUsers: number; // Limit number of doctors
  allowedRoles: AnyRole[]; // Only these roles can be created
  modules: {
    dental: boolean; // Enables Odontogram
    prescriptions: boolean; // Enables Prescription Manager
    agenda: boolean; // Enables Appointment Scheduling
  };
  accessMode?: "CENTER_WIDE" | "CARE_TEAM";
  features?: {
    anthropometryEnabled?: boolean;
  };

  // --- CRM & Legal ---
  legalInfo?: {
    rut: string;
    representativeName: string;
    representativePhone: string; // For WhatsApp
    email: string;
    address?: string;
  };
  subscription?: {
    planName: string;
    price: number;
    currency: "UF" | "CLP";
    lastPaymentDate?: string;
    status: "active" | "late" | "suspended";
  };

  // --- Aggregated Stats (Cloud Functions) ---
  stats?: {
    staffCount?: number;
    patientCount?: number;
    appointmentCount?: number;
    consultationCount?: number;
    totalPatients?: number; // Aliased for SuperAdminDashboard logic
    totalStaff?: number; // Aliased for SuperAdminDashboard logic
    updatedAt?: FirestoreDateLike;
  };

  // --- Branding & Marketing ---
  branding?: BrandKit;
}

export type AuditEntityType =
  | "patient"
  | "consultation"
  | "appointment"
  | "document"
  | "centerSettings";

export type AuditAction =
  | "ACCESS"
  | "LOGIN"
  | "PATIENT_CREATE"
  | "PATIENT_UPDATE"
  | "PATIENT_ARCHIVE"
  | "CONSULTATION_CREATE"
  | "CONSULTATION_UPDATE"
  | "CONSULTATION_ARCHIVE"
  | "APPOINTMENT_CREATE"
  | "APPOINTMENT_UPDATE"
  | "APPOINTMENT_CANCEL"
  | "APPOINTMENT_ARCHIVE"
  | "CARE_TEAM_UPDATE"
  | "CENTER_ACCESSMODE_UPDATE"
  | "ARCHIVE_BLOCKED_RETENTION"
  | "create"
  | "update"
  | "delete"
  | "login"
  | "access";

export interface AuditLogEntry {
  id: string;
  centerId: string;
  timestamp: FirestoreDateLike;
  actorUid?: string;
  actorName?: string; // Who did it
  actorRole?: string;
  action?: AuditAction;
  type?: string;
  entityType: AuditEntityType;
  entityId: string;
  patientId?: string;
  metadata?: Record<string, string | number | boolean | null | undefined>;
  details?: string;
  targetId?: string; // legacy compatibility
}

export type AuditLogEvent = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  patientId?: string;
  metadata?: JsonMap;
  details?: string;
};

export interface SoftDeletable {
  active: boolean;
  deletedAt?: Timestamp;
  deletedBy?: string;
  deleteReason?: string;
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
}

export interface Allergy {
  id: string;
  type: "Farmaco" | "Alimento" | "Otro";
  substance: string;
  reaction: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: "image" | "pdf" | "other";
  date: string;
  url: string;
}

export interface Prescription {
  id: string;
  type:
  | "Receta Médica"
  | "Receta Retenida"
  | "Interconsulta"
  | "Certificado"
  | "Indicaciones"
  | "Solicitud de Examen"
  | "OrdenExamenes";
  content: string;
  createdAt: string;
  category?: "lab_general" | "inmuno" | "cardio" | "pulmonar" | "imagenes";
  group?: string;
  items?: Array<{
    label: string;
    code?: string;
    modality?: "RX" | "TC" | "RM" | "ECO" | null;
    contrast?: "con" | "sin" | null;
  }>;
  notes?: string;
  createdBy?: string;
  status?: "draft" | "final";
  metadata?: {
    selectedExams?: string[];
  } & JsonMap;
}

export interface ClinicalTemplate {
  id: string;
  title: string;
  content: string;
  roles?: RoleId[];
  userId?: string;
  createdAt?: string;
  category?: "indication" | "certificate";
  tags?: string[];
}

export interface WhatsappTemplate {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  updatedAt?: FirestoreDateLike;
}

// NEW INTERFACE FOR CUSTOM EXAMS
export interface ExamDefinition {
  id: string;
  label: string;
  unit: string;
  category: string;
  readOnly?: boolean;
}

export interface ExamProfile {
  id: string;
  label: string;
  exams: string[]; // IDs from TRACKED_EXAMS_OPTIONS
  description?: string;
}

export interface ToothState {
  id: number;
  status: "Sano" | "Caries" | "Obturado" | "Ausente" | "Endodoncia" | "Corona" | "Extraccion_Ind";
  notes?: string;
}

export interface NailState {
  id: string; // e.g. "L1" (Left 1, Big toe), "R5" (Right 5, Little toe)
  status:
  | "Sana"
  | "Onicomicosis"
  | "Onicocriptosis"
  | "Onicogrifosis"
  | "Ausente"
  | "Atrofica"
  | "Traumatica";
  notes?: string;
}

export interface ExamSheet {
  id: string;
  date: string; // YYYY-MM-DD
  exams: Record<string, string>;
}

export interface Consultation extends SoftDeletable {
  id: string;
  date: string;
  createdAt?: FirestoreDateLike;
  patientId?: string;
  centerId?: string;
  createdBy?: string;

  weight?: string;
  height?: string;
  bmi?: string;
  bloodPressure?: string;
  heartRate?: string; // Frecuencia Cardiaca
  hgt?: string;

  // --- New Anthropometry Fields ---
  waist?: string; // Cintura
  hip?: string; // Cadera

  // --- Dynamic Exams ---
  exams?: Record<string, string>; // Stores values like { 'hba1c': '7.5', 'creatinina': '1.2' }
  examSheets?: ExamSheet[];

  reason: string;
  anamnesis: string;
  physicalExam: string;
  diagnosis: string;

  dentalMap?: ToothState[];
  podogram?: NailState[];

  prescriptions: Prescription[];
  professionalName: string;
  professionalId: string;
  professionalRole: ProfessionalRole;
  professionalRut: string;

  nextControlDate?: string;
  nextControlReason?: string;
  reminderActive?: boolean;
}

export interface Patient extends SoftDeletable {
  id: string;
  centerId: string; // Multi-tenant ID
  createdAt?: FirestoreDateLike;
  ownerUid?: string; // UID of the professional who owns this patient
  accessControl?: {
    allowedUids: string[]; // Professional UIDs who can view/edit
    centerIds: string[]; // Center IDs where admins can manage
  };
  careTeamUids?: string[]; // UIDs of professionals explicitly involved in care
  careTeamUpdatedAt?: FirestoreDateLike;
  careTeamUpdatedBy?: string;
  rut: string;
  fullName: string;
  birthDate: string;
  gender: "Masculino" | "Femenino" | "Otro";
  genderIdentity?: string; // FHIR Core-CL
  insurance?: "FONASA" | "ISAPRE" | "DIPRECA" | "CAPREDENA" | "Particular" | "Otro";
  insuranceLevel?: "A" | "B" | "C" | "D" | string;
  email?: string;
  phone?: string;
  address?: string;
  commune?: string;
  ethnicity?: string; // DEIS Pueblos Originarios
  nationality?: string; // DEIS Nacionalidad

  occupation?: string;
  livingWith?: string[];

  // --- Bio-Markers Subscription ---
  activeExams?: string[]; // List of exam IDs (e.g., ['hba1c', 'tsh'])

  medicalHistory: string[];
  medicalHistoryDetails?: string;
  cancerDetails?: string;

  surgicalHistory: string[];
  surgicalHistoryDetails?: string;
  herniaDetails?: string;

  smokingStatus: "No fumador" | "Ex fumador" | "Fumador actual";
  cigarettesPerDay?: number;
  yearsSmoking?: number;
  packYearsIndex?: number;

  alcoholStatus: "No consumo" | "Ocasional" | "Frecuente";
  alcoholFrequency?: "1-2 veces/sem" | "3-5 veces/sem" | "Todos los días";

  drugUse?: "No" | "Si";
  drugDetails?: string;

  medications: Medication[];
  allergies: Allergy[];

  consultations: Consultation[];
  kinePrograms?: KinesiologyProgram[];
  whatsAppTemplates?: WhatsappTemplate[];
  attachments: Attachment[];

  lastUpdated: string;
  consent?: boolean;
  consentDate?: string;

  // --- Google Drive Integration ---
  driveFileId?: string;
  driveFileLink?: string;
}

export interface KinesiologyProgram {
  id: string;
  patientId: string;
  type: "Kinesioterapia motora" | "Kinesioterapia respiratoria";
  diagnosis: string;
  clinicalCondition: string;
  objectives: string[];
  totalSessions: number;
  sessions: KinesiologySession[]; // Embedded sessions or linked by ID? Embedded is easier for NoSQL.
  createdAt: string;
  status: "active" | "completed";
  professionalName: string;
}

export interface KinesiologySession {
  id: string;
  date: string;
  sessionNumber: number;

  // Techniques (handled as string list)
  techniques: string[];

  // Motora Fields
  vitals?: {
    pre: { pa: string; fc: string };
    post: { pa: string; fc: string };
  };

  // Respiratoria Fields
  oxygenation?: {
    pre: { sat: string; fc: string };
    post: { sat: string; fc: string };
  };
  secretions?: "Si" | "No";

  tolerance: "Buena" | "Regular" | "Mala";
  response: "Mejoría" | "Igual" | "Empeora";
  observations: string;
}

export interface Appointment extends SoftDeletable {
  id: string;
  centerId: string; // Multi-tenant ID
  createdAt?: FirestoreDateLike;
  doctorId: string;
  doctorUid?: string;
  date: string;
  time: string;
  patientName: string;
  patientRut: string;
  patientId?: string;
  patientPhone?: string;
  patientEmail?: string;
  bookedAt?: FirestoreDateLike;
  cancelledAt?: FirestoreDateLike;
  status: "available" | "booked";
}

export interface Preadmission {
  id: string;
  centerId: string;
  patientDraft?: Partial<Patient>;
  appointmentDraft?: Partial<Appointment>;
  contact?: {
    name?: string;
    rut?: string;
    phone?: string;
    email?: string;
  };
  source?: "public" | "staff";
  submittedByUid?: string | null;
  createdAt?: FirestoreDateLike;
  status?: "pending" | "approved" | "rejected";
}

export interface AgendaConfig {
  slotDuration: number;
  startTime: string;
  endTime: string;
}

export type RoleId =
  | "ADMIN_CENTRO"
  | "ADMINISTRATIVO"
  | "MEDICO"
  | "ENFERMERA"
  | "TENS"
  | "NUTRICIONISTA"
  | "PSICOLOGO"
  | "KINESIOLOGO"
  | "TERAPEUTA_OCUPACIONAL"
  | "FONOAUDIOLOGO"
  | "PODOLOGO"
  | "TECNOLOGO_MEDICO"
  | "ASISTENTE_SOCIAL"
  | "PREPARADOR_FISICO"
  | "MATRONA"
  | "ODONTOLOGO"
  | "QUIMICO_FARMACEUTICO"
  | "SUPER_ADMIN";

/**
 * Roles canónicos usados por Auth Claims / Firestore Rules (snake_case).
 * Mantener compatibilidad con roles legacy definidos en RoleId.
 */
export type CanonicalRole = "super_admin" | "center_admin" | "admin" | "doctor" | "staff";

/**
 * AnyRole permite convivir con strings legacy (UI antigua) y roles canónicos.
 * Útil mientras migramos componentes gradualmente.
 */
export type AnyRole = RoleId | CanonicalRole | "superadmin" | "SUPERADMIN" | "Administrador" | "Admin";

/**
 * @deprecated Mantener por compatibilidad. Usar RoleId.
 */
export type ProfessionalRole = RoleId;

export interface Doctor {
  id: string;
  centerId: string; // Multi-tenant ID
  rut: string;
  fullName: string;
  photoUrl?: string; // NEW: Profile photo for booking
  accessRole?: string;
  clinicalRole?: string;
  role: AnyRole;
  specialty: string;
  visibleInBooking?: boolean;
  university?: string;
  email: string;
  /** @deprecated Autenticación real se gestiona con Firebase Auth (Google). */
  isAdmin?: boolean; // NEW: Controls access to AdminDashboard
  active?: boolean;
  agendaConfig?: AgendaConfig;
  savedTemplates?: ClinicalTemplate[];
  savedExamProfiles?: ExamProfile[];
  customExams?: ExamDefinition[]; // NEW: Allows doctor to define their own exams
  preferences?: {
    vitalsEnabled?: boolean;
    // can add more user-specific settings here
  };
}

export interface CenterInvite {
  id: string;
  centerId: string;
  email: string; // lowercased
  fullName?: string;
  role: AnyRole;
  /** Roles múltiples (preferido). Si existe, úsalo sobre `role`. */
  roles?: AnyRole[];
  createdAt?: FirestoreDateLike;
  createdBy?: string; // uid
  status?: "pending" | "claimed" | "revoked";
  claimedAt?: FirestoreDateLike;
  claimedBy?: string; // uid
  photoUrl?: string;
}

export type ViewMode =
  | "home"
  | "landing"
  | "center-portal"
  | "invite"
  | "patient-menu"
  | "patient-cancel"
  | "patient-form"
  | "patient-upload"
  | "patient-booking"
  | "doctor-login"
  | "doctor-dashboard"
  | "admin-login"
  | "admin-dashboard"
  | "select-center"
  | "superadmin-login"
  | "superadmin-dashboard"
  | "terms"
  | "privacy";

/**
 * Representa el perfil global del usuario autenticado (desde /users/{uid}).
 */
export interface UserProfile {
  id: string; // Habitualmente el UID
  uid: string;
  email: string;
  fullName: string;
  roles: AnyRole[];
  centers: string[]; // IDs de centros donde tiene acceso
  centros?: string[]; // Compatibilidad legacy con 'centers'
  isAdmin?: boolean; // Si tiene permisos administrativos globales o en algún centro
  role?: string; // Role principal para mostrar en UI
  displayName?: string;
  photoURL?: string;
  activeCenterId?: string | null;
  active?: boolean;
  billing?: {
    plan: "professional" | "basic" | "free";
    status: "active" | "overdue" | "suspended" | "trial";
    nextDueDate?: string;
    monthlyPrice?: number;
    currency?: "UF" | "CLP";
    lastPaidAt?: string;
  };
}
