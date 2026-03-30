import { z } from 'zod';

/**
 * Esquema base para el Kit de Marca (BrandKit)
 */
export const BrandKitSchema = z.object({
  logoUrls: z.array(z.string()).optional(),
  backgroundImages: z.array(z.string()).optional(),
  colors: z.object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  }).optional(),
  tagline: z.string().optional(),
  fontFamily: z.string().optional(),
});

/**
 * Esquema completo para un Centro Médico (MedicalCenter)
 * Basado en la interfaz canónica de types.ts
 */
export const MedicalCenterSchema = z.object({
  id: z.string().min(1, "ID es requerido"),
  slug: z.string().min(1, "Slug es requerido"),
  name: z.string().min(1, "Nombre es requerido"),
  logoUrl: z.string().optional(),
  primaryColor: z.string().default('indigo'),
  active: z.boolean().default(true),
  isActive: z.boolean().optional(), // Retrocompatibilidad
  maxUsers: z.number().int().positive().default(10),
  allowedRoles: z.array(z.string()).optional(),
  modules: z.object({
    dental: z.boolean().default(false),
    prescriptions: z.boolean().default(false),
    agenda: z.boolean().default(true),
  }).default({ dental: false, prescriptions: false, agenda: true }),
  accessMode: z.enum(["CENTER_WIDE", "CARE_TEAM"]).default("CENTER_WIDE"),
  features: z.object({
    anthropometryEnabled: z.boolean().optional(),
  }).optional(),
  legalInfo: z.object({
    rut: z.string().optional(),
    representativeName: z.string().optional(),
    representativePhone: z.string().optional(),
    email: z.string().email("Email inválido").optional().or(z.literal("")),
    address: z.string().optional(),
  }).optional(),
  subscription: z.object({
    planName: z.string().default('trial'),
    price: z.number().nonnegative().default(0),
    currency: z.enum(["UF", "CLP"]).default('UF'),
    lastPaymentDate: z.string().optional(),
    status: z.enum(["active", "late", "suspended"]).default('active'),
  }).optional(),
  branding: BrandKitSchema.optional(),
  createdAt: z.any().optional(), // Timestamp o string ISO
  updatedAt: z.any().optional(),
});

/**
 * Esquema para el input de upsertCenter
 * Permite campos opcionales excepto los identificadores críticos
 */
export const UpsertCenterInputSchema = MedicalCenterSchema.partial().extend({
  id: z.string().min(1, "id es requerido"),
  name: z.string().min(1, "name es requerido"),
  slug: z.string().min(1, "slug es requerido"),
  auditReason: z.string().optional(),
});

/**
 * Esquema para la baja lógica de un centro
 */
export const DecommissionCenterInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  reason: z.string().min(3, "El motivo debe tener al menos 3 caracteres"),
});

/**
 * Esquema para la configuración de WhatsApp
 */
export const UpdateWhatsappConfigInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  phoneNumberId: z.string().min(1, "phoneNumberId es requerido"),
  accessToken: z.string().optional(),
  secretaryPhone: z.string().optional(),
  verifyToken: z.string().optional(),
});

/**
 * Esquema para aceptar una invitación
 */
export const AcceptInviteInputSchema = z.object({
  token: z.string().min(1, "token es requerido"),
});

/**
 * Esquema para crear una invitación de administrador
 */
export const CreateInviteInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  adminEmail: z.string().email("email inválido"),
  centerName: z.string().min(1, "centerName es requerido"),
});

/**
 * Esquema para cancelar una cita desde el portal del paciente
 */
export const CancelAppointmentInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  appointmentId: z.string().min(1, "appointmentId es requerido"),
  rut: z.string().min(1, "RUT es requerido"),
  phone: z.string().min(1, "phone es requerido"),
});

/**
 * Esquema para la elevación de privilegios de SuperAdmin
 */
export const SetSuperAdminInputSchema = z.object({
  uid: z.string().min(1, "uid es requerido"),
  action: z.enum(["set", "remove"]).default("set"),
});

/**
 * Esquema para el registro manual de eventos de auditoría
 */
export const LogAuditInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  action: z.string().min(1, "action es requerido"),
  entityType: z.enum([
    "patient",
    "consultation",
    "appointment",
    "document",
    "centerSettings",
    "staff",
  ]),
  entityId: z.string().min(1, "entityId es requerido"),
  metadata: z.record(z.string(), z.any()).optional(),
});

/**
 * Esquema para la generación de posters de marketing
 */
export const GenerateMarketingPosterInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  format: z.enum(["feed", "story", "whatsapp", "internal"]),
  message: z.string().min(1, "message es requerido"),
});

/**
 * Esquema para vincular un paciente a un profesional
 */
export const LinkPatientInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  patientId: z.string().min(1, "patientId es requerido"),
});

/**
 * Esquema para crear una notificación para un centro
 */
export const CreateNotificationInputSchema = z.object({
  centerId: z.string().min(1, "centerId es requerido"),
  title: z.string().min(1, "title es requerido"),
  body: z.string().min(1, "body es requerido"),
  type: z.enum(["info", "warning", "error", "success"]).default("info"),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
});
