import type { Attachment } from "../../../types";

export const isProfilePictureAttachment = (attachment: Attachment) =>
  attachment.type === "profile_picture" ||
  (attachment.type === "image" && (attachment.name?.toLowerCase().includes("perfil") ?? false));
