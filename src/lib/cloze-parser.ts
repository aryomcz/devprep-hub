export type ClozeItem = {
  index: number;
  placeholder: string;
  answer: string;
  hint?: string;
  isCodeCloze: boolean;
};

export type ClozeParseResult = {
  items: ClozeItem[];
  renderedPrompt: string;
  clozeCount: number;
};

type FenceState = {
  char: "`" | "~";
  length: number;
};

function findClosingDoubleBrace(text: string, startIndex: number): number {
  let braceDepth = 0;
  let fallbackIdx = -1;

  for (let i = startIndex; i < text.length - 1; i++) {
    const ch = text[i];
    if (ch === "{" && text[i + 1] === "{") {
      if (fallbackIdx !== -1) {
        return fallbackIdx;
      }
      i++;
      continue;
    }
    if (ch === "{" && text[i + 1] !== "{") {
      braceDepth++;
    } else if (ch === "}") {
      if (braceDepth > 0) {
        if (text[i + 1] === "}" && fallbackIdx === -1) {
          fallbackIdx = i;
        }
        braceDepth--;
      } else if (text[i + 1] === "}") {
        return i;
      }
    }
  }

  return fallbackIdx;
}

function parseClozeBody(raw: string): { answer: string; hint?: string } | null {
  const sep = raw.indexOf("::");
  if (sep === -1) {
    const answer = raw.trim();
    return answer ? { answer } : null;
  }

  const answer = raw.slice(0, sep).trim();
  if (!answer) return null;

  const hint = raw.slice(sep + 2).trim();
  return hint ? { answer, hint } : { answer };
}

function pushClozeItem(
  items: ClozeItem[],
  parsed: { answer: string; hint?: string },
  isCodeCloze: boolean,
): string {
  const index = items.length + 1;
  const placeholder = `___CLOZE_${index}___`;
  const item: ClozeItem = {
    index,
    placeholder,
    answer: parsed.answer,
    isCodeCloze,
  };
  if (parsed.hint !== undefined) {
    item.hint = parsed.hint;
  }
  items.push(item);
  return placeholder;
}

function parseSegment(
  segment: string,
  isCode: boolean,
  items: ClozeItem[],
): string {
  let out = "";
  let i = 0;

  while (i < segment.length) {
    if (isCode) {
      if (segment.startsWith("{{cloze:", i)) {
        const closeIdx = findClosingDoubleBrace(segment, i + 8);
        if (closeIdx !== -1) {
          const parsed = parseClozeBody(segment.slice(i + 8, closeIdx));
          if (parsed) {
            out += pushClozeItem(items, parsed, true);
            i = closeIdx + 2;
            continue;
          }
        }
      }
      out += segment[i];
      i++;
      continue;
    }

    if (segment.startsWith("\\{\\{", i)) {
      out += "{{";
      i += 4;
      continue;
    }
    if (segment.startsWith("\\}\\}", i)) {
      out += "}}";
      i += 4;
      continue;
    }
    if (segment.startsWith("{{", i)) {
      const closeIdx = findClosingDoubleBrace(segment, i + 2);
      if (closeIdx !== -1) {
        const parsed = parseClozeBody(segment.slice(i + 2, closeIdx));
        if (parsed) {
          out += pushClozeItem(items, parsed, false);
          i = closeIdx + 2;
          continue;
        }
      }
      out += "{{";
      i += 2;
      continue;
    }

    out += segment[i];
    i++;
  }

  return out;
}

function findMatchingBackticks(line: string, start: number, tickLen: number): number {
  let i = start;
  while (i < line.length) {
    if (line[i] === "`") {
      let run = 0;
      while (i + run < line.length && line[i + run] === "`") {
        run++;
      }
      if (run === tickLen) {
        return i;
      }
      i += run;
    } else {
      i++;
    }
  }
  return -1;
}

function parseProseLine(line: string, items: ClozeItem[]): string {
  let out = "";
  let proseStart = 0;
  let i = 0;

  while (i < line.length) {
    if (line[i] !== "`") {
      i++;
      continue;
    }

    let tickLen = 0;
    while (i + tickLen < line.length && line[i + tickLen] === "`") {
      tickLen++;
    }

    const closeStart = findMatchingBackticks(line, i + tickLen, tickLen);
    if (closeStart === -1) {
      i += tickLen;
      continue;
    }

    out += parseSegment(line.slice(proseStart, i), false, items);
    const ticks = "`".repeat(tickLen);
    const codeInner = line.slice(i + tickLen, closeStart);
    out += ticks + parseSegment(codeInner, true, items) + ticks;

    i = closeStart + tickLen;
    proseStart = i;
  }

  if (proseStart < line.length) {
    out += parseSegment(line.slice(proseStart), false, items);
  }

  return out;
}

function detectFence(line: string): FenceState | null {
  const match = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return null;
  const marker = match[1];
  return {
    char: marker[0] as "`" | "~",
    length: marker.length,
  };
}

function isClosingFence(line: string, openFence: FenceState): boolean {
  const trimmed = line.trim();
  if (trimmed.length < openFence.length) return false;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] !== openFence.char) return false;
  }
  return /^[ \t]{0,3}[`~]+[ \t]*$/.test(line);
}

export function parseClozeMarkdown(markdown: string): ClozeParseResult {
  const items: ClozeItem[] = [];
  const lines = markdown.split("\n");
  const renderedLines: string[] = [];
  let activeFence: FenceState | null = null;

  for (const rawLine of lines) {
    const cleanLine = rawLine.replace(/\r$/, "");

    if (activeFence) {
      if (isClosingFence(cleanLine, activeFence)) {
        activeFence = null;
        renderedLines.push(rawLine);
      } else {
        renderedLines.push(parseSegment(rawLine, true, items));
      }
      continue;
    }

    const openingFence = detectFence(cleanLine);
    if (openingFence) {
      activeFence = openingFence;
      renderedLines.push(rawLine);
      continue;
    }

    renderedLines.push(parseProseLine(rawLine, items));
  }

  return {
    items,
    renderedPrompt: renderedLines.join("\n"),
    clozeCount: items.length,
  };
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function evaluateClozeAnswer(
  userInput: string,
  expectedAnswer: string,
  isCodeCloze = false,
  options?: { caseSensitive?: boolean },
): boolean {
  const actual = normalizeWhitespace(userInput);
  const expected = normalizeWhitespace(expectedAnswer);
  if (!actual || !expected) return false;

  const caseSensitive = options?.caseSensitive ?? isCodeCloze;
  return caseSensitive
    ? actual === expected
    : actual.toLowerCase() === expected.toLowerCase();
}
