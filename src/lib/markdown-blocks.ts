export type MarkdownBlock =
  | { type: "code"; lang: string; content: string; lineIndex: number }
  | { type: "hr"; lineIndex: number }
  | {
      type: "heading";
      level: 1 | 2 | 3;
      content: string;
      lineIndex: number;
    }
  | { type: "blockquote"; content: string; lineIndex: number }
  | { type: "list"; items: string[]; lineIndex: number }
  | { type: "paragraph"; content: string; lineIndex: number };

const INLINE_SPLIT_REGEX =
  /(___CLOZE_\d+___|``[^`]+``|`[^`]+`|\*\*[^*]+\*\*)/g;

/** Split inline prose into Cloze placeholders, inline code spans, bold spans, and plain text. */
export function splitInlineMarkdownTokens(text: string): string[] {
  return text.split(INLINE_SPLIT_REGEX).filter(Boolean);
}

/** Tokenize a subset of Markdown into structured blocks for editors, quizzes, and A4 print views. */
export function tokenizeMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(```|~~~)/.test(trimmed)) {
      const marker = trimmed.startsWith("```") ? "```" : "~~~";
      const lang = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({
        type: "code",
        lang,
        content: codeLines.join("\n"),
        lineIndex: i,
      });
      continue;
    }

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed === "---" || trimmed === "***") {
      blocks.push({ type: "hr", lineIndex: i });
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      blocks.push({
        type: "heading",
        level: 3,
        content: trimmed.slice(4),
        lineIndex: i,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      blocks.push({
        type: "heading",
        level: 2,
        content: trimmed.slice(3),
        lineIndex: i,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("# ")) {
      blocks.push({
        type: "heading",
        level: 1,
        content: trimmed.slice(2),
        lineIndex: i,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      blocks.push({
        type: "blockquote",
        content: trimmed.slice(2),
        lineIndex: i,
      });
      i++;
      continue;
    }

    if (/^([-*]|\d+\.)\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^([-*]|\d+\.)\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^([-*]|\d+\.)\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", items, lineIndex: i });
      continue;
    }

    blocks.push({ type: "paragraph", content: line, lineIndex: i });
    i++;
  }

  return blocks;
}
