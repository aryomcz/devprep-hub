export const MAX_DIFF_CHARS = 12_000;

export const TRUNCATION_MARKER =
  "\n\n... [TRUNCATED: melebihi batas 12.000 karakter]";

export type SanitizedDiffResult = {
  sanitizedText: string;
  truncated: boolean;
  skippedFiles: string[];
  originalLength: number;
};

const LOCKFILE_NAMES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
  "cargo.lock",
  "composer.lock",
  "poetry.lock",
  "gemfile.lock",
  "go.sum",
]);

const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".bmp",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mp3",
  ".wav",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".wasm",
]);

function extractDiffFilePath(block: string): string {
  const firstLine = block.split("\n", 1)[0] ?? "";
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(firstLine.trim());
  if (!match) return "";
  const bPath = match[2]?.trim();
  const aPath = match[1]?.trim();
  if (bPath && bPath !== "/dev/null") return bPath;
  return aPath ?? "";
}

function isLockfilePath(filePath: string): boolean {
  const basename = filePath.split("/").pop()?.toLowerCase() ?? "";
  return LOCKFILE_NAMES.has(basename);
}

function isBinaryDiffBlock(filePath: string, block: string): boolean {
  if (/^Binary files .+ differ$/m.test(block) || /^GIT binary patch$/m.test(block)) {
    return true;
  }
  const lower = filePath.toLowerCase();
  const dotIdx = lower.lastIndexOf(".");
  return dotIdx !== -1 && BINARY_EXTENSIONS.has(lower.slice(dotIdx));
}

function applyTruncation(
  text: string,
  maxChars: number,
): { sanitizedText: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { sanitizedText: text, truncated: false };
  }

  if (maxChars <= TRUNCATION_MARKER.length) {
    return {
      sanitizedText: TRUNCATION_MARKER.slice(0, Math.max(0, maxChars)),
      truncated: true,
    };
  }

  const sliceLen = maxChars - TRUNCATION_MARKER.length;
  return {
    sanitizedText: text.slice(0, sliceLen).trimEnd() + TRUNCATION_MARKER,
    truncated: true,
  };
}

export function sanitizeCodeOrDiff(
  raw: string,
  maxChars = MAX_DIFF_CHARS,
): SanitizedDiffResult {
  const normalized = raw.replace(/\r\n/g, "\n");
  const originalLength = normalized.length;
  const skippedFiles: string[] = [];

  if (!normalized.trim()) {
    return {
      sanitizedText: "",
      truncated: false,
      skippedFiles,
      originalLength,
    };
  }

  let filtered = normalized;

  if (/(?:^|\n)diff --git /.test(normalized)) {
    const blocks = normalized
      .split(/(?=(?:^|\n)diff --git )/)
      .map((b) => b.replace(/^\n/, ""))
      .filter(Boolean);

    const keptBlocks: string[] = [];
    for (const block of blocks) {
      const filePath = extractDiffFilePath(block);
      if (filePath && (isLockfilePath(filePath) || isBinaryDiffBlock(filePath, block))) {
        skippedFiles.push(filePath);
        continue;
      }
      keptBlocks.push(block);
    }

    filtered = keptBlocks.join("\n");
  }

  const { sanitizedText, truncated } = applyTruncation(filtered, maxChars);

  return {
    sanitizedText,
    truncated,
    skippedFiles,
    originalLength,
  };
}
