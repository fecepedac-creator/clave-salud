
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
  allowedRoles: AnyRole[]; // Only these roles can be created // Only these roles can be created
  modules: {
      dental: boolean; // Enables Odontogram
      prescriptions: boolean; // Enables Prescription Manager
      agenda: boolean; // Enables Appointment Scheduling
  }

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
      currency: 'UF' | 'CLP';
      lastPaymentDate?: string;
      status: 'active' | 'late' | 'suspended';
  };
}

export interface AuditLogEntry {
  id: string;
  centerId: string;
  timestamp: string;
  actorUid?: string;
  actorName: string; // Who did it
  actorRole: string;
  action: 'create' | 'update' | 'delete' | 'login' | 'access';
  details: string; // "Created consultation for Juan Perez"
  targetId?: string; // ID of the patient or appointment affected
}

export interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
}

export interface Allergy {
  id: string;
  type: 'Farmaco' | 'Alimento' | 'Otro';
  substance: string;
  reaction: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'pdf' | 'other';
  date: string;
  url: string; 
}

export interface Prescription {
  id: string;
  type: 'Receta Médica' | 'Receta Retenida' | 'Interconsulta' | 'Certificado' | 'Indicaciones' | 'Solicitud de Examen';
  content: string;
  createdAt: string;
}

export interface ClinicalTemplate {
  id: string;
  title: string;
  content: string;
  roles?: RoleId[]; 
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
  status: 'Sano' | 'Caries' | 'Obturado' | 'Ausente' | 'Endodoncia' | 'Corona' | 'Extraccion_Ind';
  notes?: string;
}

export interface Consultation {
  id: string;
  date: string; 
  
  weight?: string;
  height?: string;
  bmi?: string;
  bloodPressure?: string;
  hgt?: string;
  
  // --- New Anthropometry Fields ---
  waist?: string; // Cintura
  hip?: string;   // Cadera

  // --- Dynamic Exams ---
  exams?: Record<string, string>; // Stores values like { 'hba1c': '7.5', 'creatinina': '1.2' }

  reason: string;
  anamnesis: string; 
  physicalExam: string; 
  diagnosis: string; 
  
  dentalMap?: ToothState[];
  
  prescriptions: Prescription[]; 
  professionalName: string;
  professionalId: string;
  professionalRole: ProfessionalRole; 
  
  nextControlDate?: string;
  nextControlReason?: string;
  reminderActive?: boolean;
}

export interface Patient {
  id: string;
  centerId: string; // Multi-tenant ID
  rut: string;
  fullName: string;
  birthDate: string;
  gender: 'Masculino' | 'Femenino' | 'Otro';
  email?: string;
  phone?: string;
  address?: string;
  commune?: string;
  
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
  
  smokingStatus: 'No fumador' | 'Ex fumador' | 'Fumador actual';
  cigarettesPerDay?: number;
  yearsSmoking?: number;
  packYearsIndex?: number;

  alcoholStatus: 'No consumo' | 'Ocasional' | 'Frecuente';
  alcoholFrequency?: '1-2 veces/sem' | '3-5 veces/sem' | 'Todos los días';

  drugUse?: 'No' | 'Si';
  drugDetails?: string;
  
  medications: Medication[];
  allergies: Allergy[];
  
  consultations: Consultation[];
  attachments: Attachment[];
  
  lastUpdated: string;
}

export interface Appointment {
  id: string;
  centerId: string; // Multi-tenant ID
  doctorId: string; 
  doctorUid?: string;
  date: string; 
  time: string; 
  patientName: string;
  patientRut: string;
  patientPhone?: string;
  bookedAt?: any;
  cancelledAt?: any;
  status: 'available' | 'booked';
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
  createdAt?: any;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface AgendaConfig {
  slotDuration: number;
  startTime: string; 
  endTime: string;
}

export type RoleId =
  | 'ADMIN_CENTRO'
  | 'ADMINISTRATIVO'
  | 'MEDICO'
  | 'ENFERMERA'
  | 'TENS'
  | 'NUTRICIONISTA'
  | 'PSICOLOGO'
  | 'KINESIOLOGO'
  | 'TERAPEUTA_OCUPACIONAL'
  | 'FONOAUDIOLOGO'
  | 'PODOLOGO'
  | 'TECNOLOGO_MEDICO'
  | 'ASISTENTE_SOCIAL'
  | 'PREPARADOR_FISICO'
  | 'MATRONA'
  | 'ODONTOLOGO'
  | 'QUIMICO_FARMACEUTICO';

/**
 * Roles canónicos usados por Auth Claims / Firestore Rules (snake_case).
 * Mantener compatibilidad con roles legacy definidos en RoleId.
 */
export type CanonicalRole =
  | "super_admin"
  | "center_admin"
  | "admin"
  | "doctor";

/**
 * AnyRole permite convivir con strings legacy (UI antigua) y roles canónicos.
 * Útil mientras migramos componentes gradualmente.
 */
export type AnyRole = RoleId | CanonicalRole | "superadmin" | "Administrador" | "Admin";


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
  role: AnyRole;
  specialty: string;
  university?: string;
  email: string;
  /** @deprecated Autenticación real se gestiona con Firebase Auth (Google). */
  isAdmin?: boolean; // NEW: Controls access to AdminDashboard
  active?: boolean;
  activo?: boolean;
  agendaConfig?: AgendaConfig;
  savedTemplates?: ClinicalTemplate[];
  savedExamProfiles?: ExamProfile[];
  customExams?: ExamDefinition[]; // NEW: Allows doctor to define their own exams
}

export interface CenterInvite {
  id: string;
  centerId: string;
  email: string; // lowercased
  fullName?: string;
  role: AnyRole;
  /** Roles múltiples (preferido). Si existe, úsalo sobre `role`. */
  roles?: AnyRole[];
  createdAt?: any;
  createdBy?: string; // uid
  status?: "pending" | "claimed" | "revoked";
  claimedAt?: any;
  claimedBy?: string; // uid
  photoUrl?: string;
}

export type ViewMode =
  | "landing"
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
  | "superadmin-dashboard";
