import { describe, expect, it, vi } from "vitest";
import { lookupTechnicalTerm } from "@/services/external/lookup";

describe("lookupTechnicalTerm", () => {
  it("returns empty array for blank query without calling fetch", async () => {
    const mockFetch = vi.fn();
    const results = await lookupTechnicalTerm("   ", {
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches Wikipedia, MDN, and Stack Overflow in parallel with 4s AbortSignal and deduplicates URLs", async () => {
    const signals: Array<AbortSignal | null | undefined> = [];
    const mockFetch: typeof fetch = vi.fn(async (input, init) => {
      signals.push(init?.signal);
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("en.wikipedia.org")) {
        return new Response(
          JSON.stringify({
            title: "CSS Flexible Box Layout",
            extract: "One-dimensional layout model for arranging items.",
            content_urls: {
              desktop: { page: "https://en.wikipedia.org/wiki/CSS_Flexible_Box_Layout" },
            },
          }),
          { status: 200 },
        );
      }

      if (url.includes("developer.mozilla.org")) {
        return new Response(
          JSON.stringify({
            documents: [
              {
                title: "Basic concepts of flexbox",
                mdn_url: "/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox",
                summary: "The Flexible Box Module makes one-dimensional layouts easier.",
              },
            ],
          }),
          { status: 200 },
        );
      }

      if (url.includes("api.stackexchange.com")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                title: "How to center elements with CSS Flexbox?",
                link: "https://stackoverflow.com/questions/12345/center-flexbox",
                score: 420,
              },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response("Not Found", { status: 404 });
    });

    const results = await lookupTechnicalTerm("flexbox", { fetchFn: mockFetch });

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.source)).toEqual([
      "wikipedia",
      "mdn",
      "stackoverflow",
    ]);
    expect(results[1]?.url).toBe(
      "https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_flexible_box_layout/Basic_concepts_of_flexbox",
    );
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });

  it("survives partial failures when one source throws or returns 500", async () => {
    const mockFetch: typeof fetch = vi.fn(async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("en.wikipedia.org")) {
        return new Response(
          JSON.stringify({
            title: "Idempotence",
            extract: "Property of certain operations in mathematics and computer science.",
            content_urls: {
              desktop: { page: "https://en.wikipedia.org/wiki/Idempotence" },
            },
          }),
          { status: 200 },
        );
      }

      if (url.includes("developer.mozilla.org")) {
        return new Response("Server Error", { status: 500 });
      }

      throw new DOMException("Aborted", "TimeoutError");
    });

    const results = await lookupTechnicalTerm("idempotency", {
      fetchFn: mockFetch,
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      source: "wikipedia",
      title: "Idempotence",
      url: "https://en.wikipedia.org/wiki/Idempotence",
    });
  });
});
