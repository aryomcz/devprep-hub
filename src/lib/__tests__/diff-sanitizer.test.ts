import { describe, expect, it } from "vitest";
import {
  MAX_DIFF_CHARS,
  sanitizeCodeOrDiff,
} from "@/lib/diff-sanitizer";

describe("sanitizeCodeOrDiff", () => {
  it("strips package-lock.json, pnpm-lock.yaml, and yarn.lock blocks while keeping source code diffs", () => {
    const rawDiff = [
      "diff --git a/package-lock.json b/package-lock.json",
      "index 1111111..2222222 100644",
      "--- a/package-lock.json",
      "+++ b/package-lock.json",
      "@@ -1,3 +1,3 @@",
      '-  "version": "1.0.0"',
      '+  "version": "1.0.1"',
      "diff --git a/apps/web/pnpm-lock.yaml b/apps/web/pnpm-lock.yaml",
      "--- a/apps/web/pnpm-lock.yaml",
      "+++ b/apps/web/pnpm-lock.yaml",
      "+lockfileVersion: '9.0'",
      "diff --git a/yarn.lock b/yarn.lock",
      "--- a/yarn.lock",
      "+++ b/yarn.lock",
      "+lodash@^4.17.21:",
      "diff --git a/src/app/page.tsx b/src/app/page.tsx",
      "index 3333333..4444444 100644",
      "--- a/src/app/page.tsx",
      "+++ b/src/app/page.tsx",
      "@@ -1,1 +1,1 @@",
      "+export function Home() { return null; }",
    ].join("\n");

    const result = sanitizeCodeOrDiff(rawDiff);

    expect(result.truncated).toBe(false);
    expect(result.skippedFiles).toEqual([
      "package-lock.json",
      "apps/web/pnpm-lock.yaml",
      "yarn.lock",
    ]);
    expect(result.sanitizedText).not.toContain("package-lock.json");
    expect(result.sanitizedText).not.toContain("pnpm-lock.yaml");
    expect(result.sanitizedText).not.toContain("yarn.lock");
    expect(result.sanitizedText).toContain("src/app/page.tsx");
    expect(result.sanitizedText).toContain("export function Home()");
  });

  it("strips binary and image diff blocks via headers or file extensions", () => {
    const rawDiff = [
      "diff --git a/public/hero.png b/public/hero.png",
      "new file mode 100644",
      "Binary files /dev/null and b/public/hero.png differ",
      "diff --git a/assets/font.woff2 b/assets/font.woff2",
      "GIT binary patch",
      "literal 128",
      "zcmV-...",
      "diff --git a/src/lib/math.ts b/src/lib/math.ts",
      "--- a/src/lib/math.ts",
      "+++ b/src/lib/math.ts",
      "+export const add = (a: number, b: number) => a + b;",
    ].join("\n");

    const result = sanitizeCodeOrDiff(rawDiff);

    expect(result.skippedFiles).toEqual(["public/hero.png", "assets/font.woff2"]);
    expect(result.sanitizedText).not.toContain("hero.png");
    expect(result.sanitizedText).not.toContain("font.woff2");
    expect(result.sanitizedText).toContain("src/lib/math.ts");
  });

  it("truncates output strictly to at most 12,000 characters with a clear truncation marker", () => {
    const longCode = `diff --git a/src/big.ts b/src/big.ts\n+++ b/src/big.ts\n+${"x".repeat(MAX_DIFF_CHARS + 2500)}`;

    const result = sanitizeCodeOrDiff(longCode);

    expect(result.truncated).toBe(true);
    expect(result.sanitizedText.length).toBeLessThanOrEqual(MAX_DIFF_CHARS);
    expect(result.sanitizedText).toContain("[TRUNCATED");
    expect(result.originalLength).toBe(longCode.length);
  });

  it("handles plain non-diff code snippets and respects maxChars", () => {
    const shortSnippet = "export async function handler() { return true; }";
    const shortRes = sanitizeCodeOrDiff(shortSnippet);
    expect(shortRes.truncated).toBe(false);
    expect(shortRes.sanitizedText).toBe(shortSnippet);
    expect(shortRes.skippedFiles).toEqual([]);

    const longSnippet = "a".repeat(MAX_DIFF_CHARS + 500);
    const longRes = sanitizeCodeOrDiff(longSnippet);
    expect(longRes.truncated).toBe(true);
    expect(longRes.sanitizedText.length).toBeLessThanOrEqual(MAX_DIFF_CHARS);
    expect(longRes.sanitizedText).toContain("[TRUNCATED");
  });
});
