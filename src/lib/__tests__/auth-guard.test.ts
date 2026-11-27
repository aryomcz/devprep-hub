import { describe, expect, it } from "vitest";
import {
  AuthGuardError,
  formatActionError,
  isAllowedEmail,
  requireAllowedUser,
  verifyCronSecret,
} from "@/lib/auth-guard";

describe("isAllowedEmail", () => {
  it("matches case-insensitively with surrounding whitespace", () => {
    expect(isAllowedEmail(" Dev@Example.com ", "dev@example.com")).toBe(true);
  });

  it("rejects different, missing, or unconfigured emails (fail-closed)", () => {
    expect(isAllowedEmail("other@example.com", "dev@example.com")).toBe(false);
    expect(isAllowedEmail(null, "dev@example.com")).toBe(false);
    expect(isAllowedEmail("", "dev@example.com")).toBe(false);
    expect(isAllowedEmail("dev@example.com", "")).toBe(false);
    expect(isAllowedEmail("dev@example.com", null)).toBe(false);
  });
});

describe("verifyCronSecret", () => {
  it("accepts matching Bearer secret and rejects invalid or empty secrets", () => {
    expect(verifyCronSecret("Bearer super-secret-123", "super-secret-123")).toBe(true);
    expect(verifyCronSecret("Bearer wrong-secret", "super-secret-123")).toBe(false);
    expect(verifyCronSecret("Bearer short", "super-secret-123")).toBe(false);
    expect(verifyCronSecret("super-secret-123", "super-secret-123")).toBe(false);
    expect(verifyCronSecret(null, "super-secret-123")).toBe(false);
    expect(verifyCronSecret("Bearer super-secret-123", "")).toBe(false);
  });
});

describe("requireAllowedUser", () => {
  it("returns user when authenticated email is allowed", async () => {
    const result = await requireAllowedUser(
      async () => ({ id: "user-1", email: "dev@example.com" }),
      "dev@example.com",
    );
    expect(result).toEqual({ id: "user-1", email: "dev@example.com" });
  });

  it("throws 401 when unauthenticated and 403 when email is forbidden", async () => {
    await expect(
      requireAllowedUser(async () => null, "dev@example.com"),
    ).rejects.toMatchObject({ status: 401 });

    await expect(
      requireAllowedUser(
        async () => ({ id: "user-2", email: "intruder@example.com" }),
        "dev@example.com",
      ),
    ).rejects.toBeInstanceOf(AuthGuardError);

    await expect(
      requireAllowedUser(
        async () => ({ id: "user-2", email: "intruder@example.com" }),
        "dev@example.com",
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("formatActionError", () => {
  it("formats 401/403 AuthGuardError, validation issues, and generic errors", () => {
    expect(
      formatActionError(
        new AuthGuardError("Unauthorized", 401),
        "Invalid",
        "Generic",
      ),
    ).toBe("Sesi berakhir. Silakan login kembali.");

    expect(
      formatActionError(
        new AuthGuardError("Forbidden", 403),
        "Invalid",
        "Generic",
      ),
    ).toBe("Akses ditolak oleh Single-User Gate.");

    expect(
      formatActionError(
        { issues: [{ message: "Field wajib diisi." }] },
        "Invalid",
        "Generic",
      ),
    ).toBe("Field wajib diisi.");

    expect(
      formatActionError({ issues: [{}] }, "Invalid fallback", "Generic"),
    ).toBe("Invalid fallback");

    expect(
      formatActionError(new Error("boom"), "Invalid", "Generic fallback"),
    ).toBe("Generic fallback");
  });
});
