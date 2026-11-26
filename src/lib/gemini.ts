import { z } from "zod";

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAY_MS = 250;

export class GeminiRateLimitError extends Error {
  readonly status = 429 as const;
  readonly retryAfterMs?: number;

  constructor(
    message = "Kuota Gemini API Free Tier sedang penuh (HTTP 429). Silakan coba lagi beberapa saat.",
    retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GeminiRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class GeminiApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GeminiApiError";
    this.status = status;
  }
}

export type GenerateStructuredJsonOptions<T> = {
  prompt: string;
  systemInstruction?: string;
  jsonSchema?: Record<string, unknown>;
  schema: z.ZodType<T>;
  timeoutMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  model?: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match ? match[1].trim() : trimmed;
}

function extractCandidateText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new GeminiApiError("Respons Gemini API kosong atau tidak valid.", 502);
  }

  const candidates = (
    payload as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    }
  ).candidates;

  const text = candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new GeminiApiError("Gemini API tidak mengembalikan teks JSON.", 502);
  }
  return stripJsonFence(text);
}

export async function generateStructuredJson<T>(
  options: GenerateStructuredJsonOptions<T>,
): Promise<T> {
  const apiKey = (options.apiKey ?? process.env.GEMINI_API_KEY)?.trim();
  if (!apiKey) {
    throw new GeminiApiError(
      "GEMINI_API_KEY belum dikonfigurasi di server.",
      500,
    );
  }

  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.min(1, Math.max(0, options.maxRetries ?? 1));
  const retryDelayMs = options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const fetchFn = options.fetchFn ?? fetch;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: options.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      ...(options.jsonSchema ? { responseSchema: options.jsonSchema } : {}),
    },
  };

  if (options.systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: options.systemInstruction }],
    };
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const parsedSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
        const retryAfterMs = Number.isFinite(parsedSeconds)
          ? Math.max(0, parsedSeconds * 1000)
          : undefined;

        if (attempt < maxRetries) {
          await sleep(retryDelayMs);
          continue;
        }
        throw new GeminiRateLimitError(undefined, retryAfterMs);
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const message = `Gemini API error (${response.status})${errorText ? `: ${errorText.slice(0, 200)}` : ""}`;
        if (response.status >= 500 && attempt < maxRetries) {
          await sleep(retryDelayMs);
          continue;
        }
        throw new GeminiApiError(message, response.status);
      }

      const rawPayload: unknown = await response.json();
      const jsonText = extractCandidateText(rawPayload);

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(jsonText);
      } catch {
        throw new GeminiApiError(
          "Output Gemini API bukan JSON yang valid.",
          502,
        );
      }

      return options.schema.parse(parsedJson);
    } catch (error) {
      if (
        error instanceof GeminiRateLimitError ||
        (error instanceof GeminiApiError && error.status < 500) ||
        error instanceof z.ZodError
      ) {
        throw error;
      }

      if (attempt < maxRetries) {
        await sleep(retryDelayMs);
        continue;
      }

      if (error instanceof GeminiApiError) {
        throw error;
      }

      throw new GeminiApiError(
        error instanceof Error
          ? error.message
          : "Gagal menghubungi Gemini API.",
        502,
      );
    }
  }

  throw new GeminiApiError("Gagal memanggil Gemini API.", 502);
}
