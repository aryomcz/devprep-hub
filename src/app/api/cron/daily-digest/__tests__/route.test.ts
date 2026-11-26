import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, curateDailyDigestForUserMock } = vi.hoisted(
  () => ({
    createAdminClientMock: vi.fn(),
    curateDailyDigestForUserMock: vi.fn(),
  }),
);

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/services/external/daily-digest", () => ({
  curateDailyDigestForUser: curateDailyDigestForUserMock,
}));

import { GET } from "@/app/api/cron/daily-digest/route";

describe("GET /api/cron/daily-digest", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret-123";
    createAdminClientMock.mockReset();
    curateDailyDigestForUserMock.mockReset();
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("rejects requests without valid Authorization: Bearer <CRON_SECRET> with 401", async () => {
    const reqMissing = new NextRequest(
      "http://localhost:3000/api/cron/daily-digest",
    );
    const resMissing = await GET(reqMissing);
    expect(resMissing.status).toBe(401);

    const reqWrong = new NextRequest(
      "http://localhost:3000/api/cron/daily-digest",
      {
        headers: { authorization: "Bearer wrong-secret" },
      },
    );
    const resWrong = await GET(reqWrong);
    expect(resWrong.status).toBe(401);
    expect(createAdminClientMock).not.toHaveBeenCalled();
  });

  it("upserts idempotently and counts only newly inserted rows", async () => {
    const selectUpsertMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "d-1" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const upsertMock = vi.fn(() => ({
      select: selectUpsertMock,
    }));

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "skills") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  {
                    user_id: "user-1",
                    id: "skill-1",
                    name: "PostgreSQL",
                    slug: "postgresql",
                    status: "gap",
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return { upsert: upsertMock };
      }),
    });

    curateDailyDigestForUserMock.mockResolvedValue([
      {
        source: "devto",
        external_id: "dev-101",
        title: "PostgreSQL Indexing",
        url: "https://dev.to/pg/indexing",
        tags: ["postgresql"],
        matched_skill_id: "skill-1",
      },
    ]);

    const makeReq = () =>
      new NextRequest("http://localhost:3000/api/cron/daily-digest", {
        headers: { authorization: "Bearer test-cron-secret-123" },
      });

    const firstRes = await GET(makeReq());
    expect(firstRes.status).toBe(200);
    await expect(firstRes.json()).resolves.toMatchObject({
      ok: true,
      usersProcessed: 1,
      entriesProcessed: 1,
    });

    const secondRes = await GET(makeReq());
    expect(secondRes.status).toBe(200);
    await expect(secondRes.json()).resolves.toMatchObject({
      ok: true,
      usersProcessed: 1,
      entriesProcessed: 0,
    });
  });

  it("returns 500 when daily_digests upsert fails", async () => {
    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "skills") {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  {
                    user_id: "user-1",
                    id: "skill-1",
                    name: "PostgreSQL",
                    slug: "postgresql",
                    status: "gap",
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        return {
          upsert: () => ({
            select: async () => ({
              data: null,
              error: { message: "DB write failure" },
            }),
          }),
        };
      }),
    });

    curateDailyDigestForUserMock.mockResolvedValue([
      {
        source: "devto",
        external_id: "dev-101",
        title: "PostgreSQL Indexing",
        url: "https://dev.to/pg/indexing",
        tags: ["postgresql"],
        matched_skill_id: "skill-1",
      },
    ]);

    const req = new NextRequest(
      "http://localhost:3000/api/cron/daily-digest",
      {
        headers: { authorization: "Bearer test-cron-secret-123" },
      },
    );
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
