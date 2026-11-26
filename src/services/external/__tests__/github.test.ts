import { describe, expect, it, vi } from "vitest";
import {
  fetchSanitizedCommitDiff,
  fetchUserGithubSkills,
  GithubSyncError,
} from "@/services/external/github";

function encodeBase64Json(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

describe("fetchUserGithubSkills", () => {
  it("filters out forks, caps at 20 non-fork repos, extracts and deduplicates skills", async () => {
    const repos = Array.from({ length: 24 }, (_, idx) => ({
      name: `repo-${idx}`,
      full_name: `aryo/repo-${idx}`,
      fork: idx === 0 || idx === 1, // 2 forks -> 22 non-fork -> capped at 20
      language: idx === 2 ? "TypeScript" : idx === 3 ? "Go" : null,
      topics:
        idx === 2
          ? ["nextjs", "postgres", "docker"]
          : idx === 4
            ? ["postgresql", "rest-api"]
            : [],
    }));

    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const mockFetch: typeof fetch = vi.fn(async (input, init) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({ url, init });

      if (url.includes("/users/aryo/repos")) {
        return new Response(JSON.stringify(repos), { status: 200 });
      }

      if (url.includes("/repos/aryo/repo-2/contents/package.json")) {
        return new Response(
          JSON.stringify({
            content: encodeBase64Json({
              dependencies: {
                next: "16.0.0",
                "@supabase/supabase-js": "^2.0.0",
                tailwindcss: "^4.0.0",
              },
              devDependencies: {
                vitest: "^5.0.0",
                "some-random-internal-helper": "^1.0.0",
              },
            }),
          }),
          { status: 200 },
        );
      }

      return new Response(JSON.stringify({ message: "Not Found" }), {
        status: 404,
      });
    });

    const result = await fetchUserGithubSkills("aryo", {
      fetchFn: mockFetch,
      token: "gh-test-token",
    });

    expect(result.scannedRepos).toBe(20);

    const repoListCall = calls.find((c) => c.url.includes("/users/aryo/repos"));
    expect(repoListCall?.init?.signal).toBeInstanceOf(AbortSignal);
    expect(
      new Headers(repoListCall?.init?.headers).get("Authorization"),
    ).toBe("Bearer gh-test-token");

    const slugs = result.skills.map((s) => s.slug);
    expect(slugs).toContain("typescript");
    expect(slugs).toContain("go");
    expect(slugs).toContain("nextjs");
    expect(slugs).toContain("postgresql");
    expect(slugs).toContain("docker");
    expect(slugs).toContain("rest-api");
    expect(slugs).toContain("supabase");
    expect(slugs).toContain("tailwindcss");
    expect(slugs).toContain("vitest");
    expect(slugs).not.toContain("some-random-internal-helper");

    // Deduplicated postgresql even though both "postgres" and "postgresql" appeared
    expect(slugs.filter((s) => s === "postgresql")).toHaveLength(1);

    const tsSkill = result.skills.find((s) => s.slug === "typescript");
    const nextSkill = result.skills.find((s) => s.slug === "nextjs");
    const restSkill = result.skills.find((s) => s.slug === "rest-api");
    expect(tsSkill?.category).toBe("language");
    expect(nextSkill?.category).toBe("framework");
    expect(restSkill?.category).toBe("concept");
  });

  it("throws GithubSyncError on 404 user not found or rate limit 403/429", async () => {
    const notFoundFetch: typeof fetch = vi.fn(
      async () => new Response("Not Found", { status: 404 }),
    );
    await expect(
      fetchUserGithubSkills("nobody", { fetchFn: notFoundFetch }),
    ).rejects.toMatchObject({ status: 404 });

    const rateLimitFetch: typeof fetch = vi.fn(
      async () => new Response("Rate limit", { status: 403 }),
    );
    await expect(
      fetchUserGithubSkills("aryo", { fetchFn: rateLimitFetch }),
    ).rejects.toBeInstanceOf(GithubSyncError);

    await expect(
      fetchUserGithubSkills("aryo", { fetchFn: rateLimitFetch }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

describe("fetchSanitizedCommitDiff", () => {
  it("fetches GitHub commit diff with 4s AbortSignal and strips lockfiles", async () => {
    let seenUrl = "";
    let seenAccept = "";
    let seenSignal: AbortSignal | null | undefined;

    const mockFetch: typeof fetch = vi.fn(async (input, init) => {
      seenUrl = typeof input === "string" ? input : input.toString();
      seenAccept = new Headers(init?.headers).get("Accept") ?? "";
      seenSignal = init?.signal;

      return new Response(
        [
          "diff --git a/package-lock.json b/package-lock.json",
          "+noise",
          "diff --git a/src/handler.ts b/src/handler.ts",
          "+export const ok = true;",
        ].join("\n"),
        { status: 200 },
      );
    });

    const result = await fetchSanitizedCommitDiff(
      "https://github.com/aryo/capstone-app/commit/abc1234def",
      { fetchFn: mockFetch, token: "tok" },
    );

    expect(seenUrl).toBe(
      "https://api.github.com/repos/aryo/capstone-app/commits/abc1234def",
    );
    expect(seenAccept).toBe("application/vnd.github.v3.diff");
    expect(seenSignal).toBeInstanceOf(AbortSignal);
    expect(result.skippedFiles).toEqual(["package-lock.json"]);
    expect(result.sanitizedText).toContain("src/handler.ts");
    expect(result.sanitizedText).not.toContain("package-lock.json");
  });

  it("rejects invalid commit URLs without calling fetch", async () => {
    const mockFetch = vi.fn();
    await expect(
      fetchSanitizedCommitDiff("https://example.com/not-github", {
        fetchFn: mockFetch as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
