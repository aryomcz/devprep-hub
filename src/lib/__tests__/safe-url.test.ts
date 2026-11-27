import { describe, expect, it } from "vitest";
import { toSafeExternalHref } from "@/lib/safe-url";

describe("toSafeExternalHref", () => {
  it("allows valid http and https URLs", () => {
    expect(toSafeExternalHref("https://github.com/vercel/next.js")).toBe(
      "https://github.com/vercel/next.js",
    );
    expect(toSafeExternalHref("http://example.com/path?a=1")).toBe(
      "http://example.com/path?a=1",
    );
  });

  it("rejects dangerous protocols, malformed strings, and empty values", () => {
    expect(toSafeExternalHref("javascript:alert(1)")).toBe("#");
    expect(toSafeExternalHref("data:text/html,<script>alert(1)</script>")).toBe(
      "#",
    );
    expect(toSafeExternalHref("vbscript:msgbox(1)")).toBe("#");
    expect(toSafeExternalHref("not a url")).toBe("#");
    expect(toSafeExternalHref("")).toBe("#");
    expect(toSafeExternalHref(null)).toBe("#");
    expect(toSafeExternalHref(undefined)).toBe("#");
  });
});
