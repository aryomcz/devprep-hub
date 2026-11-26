import { describe, expect, it } from "vitest";
import {
  evaluateClozeAnswer,
  parseClozeMarkdown,
} from "@/lib/cloze-parser";

describe("parseClozeMarkdown", () => {
  it("parses basic prose cloze and optional ::hint with whitespace trimmed", () => {
    const input =
      "Operasi {{  idempotent :: hasil tetap sama  }} mencegah {{duplikasi}} data.";
    const result = parseClozeMarkdown(input);

    expect(result.clozeCount).toBe(2);
    expect(result.items).toEqual([
      {
        index: 1,
        placeholder: "___CLOZE_1___",
        answer: "idempotent",
        hint: "hasil tetap sama",
        isCodeCloze: false,
      },
      {
        index: 2,
        placeholder: "___CLOZE_2___",
        answer: "duplikasi",
        isCodeCloze: false,
      },
    ]);
    expect(result.renderedPrompt).toBe(
      "Operasi ___CLOZE_1___ mencegah ___CLOZE_2___ data.",
    );
  });

  it("supports escaped literal braces \\{\\{...\\}\\} in prose", () => {
    const input =
      "Sintaks template memakai \\{\\{bukan_cloze\\}\\}, sedangkan {{cloze_asli}} diuji.";
    const result = parseClozeMarkdown(input);

    expect(result.clozeCount).toBe(1);
    expect(result.items[0]?.answer).toBe("cloze_asli");
    expect(result.renderedPrompt).toBe(
      "Sintaks template memakai {{bukan_cloze}}, sedangkan ___CLOZE_1___ diuji.",
    );
  });

  it("ignores {{...}} by default inside fenced code blocks and inline code", () => {
    const input = [
      "Inline JSX `style={{ color: 'red' }}` dan mustache `{{ item.name }}`.",
      "",
      "```tsx",
      "export function Box() {",
      "  return <div style={{ color: 'red' }}>ok</div>;",
      "}",
      "```",
      "",
      "~~~yaml",
      "env:",
      "  TOKEN: ${{ secrets.TOKEN }}",
      "~~~",
    ].join("\n");

    const result = parseClozeMarkdown(input);

    expect(result.clozeCount).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.renderedPrompt).toBe(input);
  });

  it("extracts explicit {{cloze:...}} inside fenced and inline code while leaving normal {{...}} untouched", () => {
    const input = [
      "Gunakan `CREATE INDEX {{cloze:CONCURRENTLY}}` dan abaikan `{{raw}}`.",
      "",
      "```tsx",
      "const val = {{cloze:useMemo::memoize value}}(() => compute(), []);",
      "return <div style={{ padding: 8 }}>{val}</div>;",
      "```",
    ].join("\n");

    const result = parseClozeMarkdown(input);

    expect(result.clozeCount).toBe(2);
    expect(result.items).toEqual([
      {
        index: 1,
        placeholder: "___CLOZE_1___",
        answer: "CONCURRENTLY",
        isCodeCloze: true,
      },
      {
        index: 2,
        placeholder: "___CLOZE_2___",
        answer: "useMemo",
        hint: "memoize value",
        isCodeCloze: true,
      },
    ]);
    expect(result.renderedPrompt).toContain("`CREATE INDEX ___CLOZE_1___`");
    expect(result.renderedPrompt).toContain("`{{raw}}`");
    expect(result.renderedPrompt).toContain(
      "const val = ___CLOZE_2___(() => compute(), []);",
    );
    expect(result.renderedPrompt).toContain(
      "return <div style={{ padding: 8 }}>{val}</div>;",
    );
  });

  it("rejects empty, whitespace-only, hint-only, and multiline cloze markers", () => {
    const input = [
      "Kosong {{}}, spasi {{   }}, hanya hint {{::petunjuk}}.",
      "Kode kosong `{{cloze:   }}`.",
      "Multiline {{baris satu",
      "baris dua}} tetap literal.",
    ].join("\n");

    const result = parseClozeMarkdown(input);

    expect(result.clozeCount).toBe(0);
    expect(result.items).toEqual([]);
    expect(result.renderedPrompt).toBe(input);
  });

  it("handles nested single braces inside prose cloze", () => {
    const input = "Bentuk object: {{a {b} c}} dalam teks.";
    const result = parseClozeMarkdown(input);

    expect(result.clozeCount).toBe(1);
    expect(result.items[0]?.answer).toBe("a {b} c");
    expect(result.renderedPrompt).toBe("Bentuk object: ___CLOZE_1___ dalam teks.");
  });
});

describe("evaluateClozeAnswer", () => {
  it("trims and collapses whitespace; case-insensitive for prose, case-sensitive default for code", () => {
    expect(
      evaluateClozeAnswer("  Rate   Limiting ", "rate limiting", false),
    ).toBe(true);

    expect(evaluateClozeAnswer("useMemo", "useMemo", true)).toBe(true);
    expect(evaluateClozeAnswer("usememo", "useMemo", true)).toBe(false);
    expect(
      evaluateClozeAnswer("usememo", "useMemo", true, { caseSensitive: false }),
    ).toBe(true);
    expect(evaluateClozeAnswer("   ", "useMemo", false)).toBe(false);
  });
});
