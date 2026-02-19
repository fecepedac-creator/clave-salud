import * as admin from "firebase-admin";

export type SendEmailParams = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  tags?: string[];
  centerId: string;
  relatedEntityId?: string;
  relatedType?: string;
  templateId?: string;
  type?: string;
};

type SendEmailResult = {
  ok: boolean;
  provider: "sendgrid";
  messageId?: string;
};

const db = admin.firestore();
const serverTimestamp = admin.firestore.FieldValue.serverTimestamp;

function requiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required email env: ${name}`);
  }
  return value;
}

function normalizeEmail(to: string): string {
  return String(to || "").trim().toLowerCase();
}

async function writeMessageLog(params: {
  centerId: string;
  to: string;
  type: string;
  templateId?: string;
  relatedType?: string;
  relatedId?: string;
  status: "sent" | "failed";
  error?: string;
  tags?: string[];
}): Promise<void> {
  await db.collection("centers").doc(params.centerId).collection("messageLogs").add({
    type: params.type,
    channel: "email",
    to: params.to,
    templateId: params.templateId || null,
    relatedType: params.relatedType || null,
    relatedId: params.relatedId || null,
    status: params.status,
    error: params.error || null,
    tags: Array.isArray(params.tags) ? params.tags : [],
    createdAt: serverTimestamp(),
  });
}

async function sendWithSendGrid(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = requiredEnv("EMAIL_PROVIDER_API_KEY");
  const from = requiredEnv("EMAIL_FROM");

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: normalizeEmail(params.to) }] }],
      from: { email: from },
      subject: params.subject,
      content: [
        ...(params.text ? [{ type: "text/plain", value: params.text }] : []),
        ...(params.html ? [{ type: "text/html", value: params.html }] : []),
      ],
      categories: params.tags,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SendGrid error ${response.status}: ${body}`);
  }

  const messageId = response.headers.get("x-message-id") || undefined;
  return { ok: true, provider: "sendgrid", messageId };
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const to = normalizeEmail(params.to);
  const type = String(params.type || params.tags?.[0] || "transactional").trim();

  if (!params.centerId) throw new Error("centerId is required");
  if (!to) throw new Error("to is required");
  if (!params.subject) throw new Error("subject is required");
  if (!params.html && !params.text) throw new Error("html or text is required");

  try {
    const result = await sendWithSendGrid({ ...params, to, type });
    await writeMessageLog({
      centerId: params.centerId,
      to,
      type,
      templateId: params.templateId,
      relatedType: params.relatedType,
      relatedId: params.relatedEntityId,
      status: "sent",
      tags: params.tags,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeMessageLog({
      centerId: params.centerId,
      to,
      type,
      templateId: params.templateId,
      relatedType: params.relatedType,
      relatedId: params.relatedEntityId,
      status: "failed",
      error: message,
      tags: params.tags,
    });
    throw error;
  }
}
