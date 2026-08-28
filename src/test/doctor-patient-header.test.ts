import { describe, expect, it } from "vitest";
import { isProfilePictureAttachment } from "../../features/doctor/utils/profilePicture";
import type { Attachment } from "../../types";

describe("isProfilePictureAttachment", () => {
  it("does not crash when a legacy image attachment has no name", () => {
    const legacyAttachment = {
      id: "legacy-image",
      type: "image",
      date: "2026-08-28",
      url: "https://example.test/legacy-image",
    } as Attachment;

    expect(() => isProfilePictureAttachment(legacyAttachment)).not.toThrow();
    expect(isProfilePictureAttachment(legacyAttachment)).toBe(false);
  });

  it("recognizes an image explicitly named as a profile picture", () => {
    const attachment: Attachment = {
      id: "profile-image",
      name: "Foto Perfil",
      type: "image",
      date: "2026-08-28",
      url: "https://example.test/profile-image",
    };

    expect(isProfilePictureAttachment(attachment)).toBe(true);
  });
});
