import { describe, expect, it } from "vitest";
import {
  splitInlineMarkdownTokens,
  tokenizeMarkdownBlocks,
} from "@/lib/markdown-blocks";

describe("tokenizeMarkdownBlocks", () => {
  it("tokenizes headings, fenced code, hr, blockquote, lists, and paragraphs", () => {
    const md = [
      "# Main Title",
      "## Section",
      "### Subsection",
      "---",
      "> Important quote",
      "- Bullet one",
      "2. Numbered two",
      "```ts",
      "const x = 1;",
      "```",
      "Final paragraph.",
    ].join("\n");

    const blocks = tokenizeMarkdownBlocks(md);
    expect(blocks.map((b) => b.type)).toEqual([
      "heading",
      "heading",
      "heading",
      "hr",
      "blockquote",
      "list",
      "code",
      "paragraph",
    ]);

    expect(blocks[0]).toMatchObject({
      type: "heading",
      level: 1,
      content: "Main Title",
    });
    expect(blocks[1]).toMatchObject({
      type: "heading",
      level: 2,
      content: "Section",
    });
    expect(blocks[2]).toMatchObject({
      type: "heading",
      level: 3,
      content: "Subsection",
    });
    expect(blocks[4]).toMatchObject({
      type: "blockquote",
      content: "Important quote",
    });
    expect(blocks[5]).toMatchObject({
      type: "list",
      items: ["Bullet one", "Numbered two"],
    });
    expect(blocks[6]).toMatchObject({
      type: "code",
      lang: "ts",
      content: "const x = 1;",
    });
    expect(blocks[7]).toMatchObject({
      type: "paragraph",
      content: "Final paragraph.",
    });
  });
});

describe("splitInlineMarkdownTokens", () => {
  it("splits cloze placeholders, inline code, and bold segments", () => {
    const tokens = splitInlineMarkdownTokens(
      "Use ___CLOZE_1___ with `SELECT *` and **MVCC** safely.",
    );
    expect(tokens).toEqual([
      "Use ",
      "___CLOZE_1___",
      " with ",
      "`SELECT *`",
      " and ",
      "**MVCC**",
      " safely.",
    ]);
  });
});
