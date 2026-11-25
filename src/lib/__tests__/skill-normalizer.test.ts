import { describe, expect, it } from "vitest";
import { normalizeSkill } from "@/lib/skill-normalizer";

describe("normalizeSkill", () => {
  it("resolves programming symbols without slug collisions", () => {
    expect(normalizeSkill("C")).toEqual({ canonicalName: "C", slug: "c" });
    expect(normalizeSkill("C++")).toEqual({
      canonicalName: "C++",
      slug: "cpp",
    });
    expect(normalizeSkill("C#")).toEqual({
      canonicalName: "C#",
      slug: "csharp",
    });
    expect(normalizeSkill(".NET")).toEqual({
      canonicalName: ".NET",
      slug: "dotnet",
    });
    expect(normalizeSkill("dotnet")).toEqual({
      canonicalName: ".NET",
      slug: "dotnet",
    });
    expect(normalizeSkill("F#")).toEqual({
      canonicalName: "F#",
      slug: "fsharp",
    });
  });

  it("normalizes spacing, dots, and casing variations", () => {
    expect(normalizeSkill("Next.js")).toEqual({
      canonicalName: "Next.js",
      slug: "nextjs",
    });
    expect(normalizeSkill("NextJS")).toEqual({
      canonicalName: "Next.js",
      slug: "nextjs",
    });
    expect(normalizeSkill("Next JS")).toEqual({
      canonicalName: "Next.js",
      slug: "nextjs",
    });
    expect(normalizeSkill("Node.js")).toEqual({
      canonicalName: "Node.js",
      slug: "nodejs",
    });
    expect(normalizeSkill("NodeJS")).toEqual({
      canonicalName: "Node.js",
      slug: "nodejs",
    });
    expect(normalizeSkill("  Rate   Limiting  ")).toEqual({
      canonicalName: "Rate Limiting",
      slug: "rate-limiting",
    });
  });

  it("maps curated ADR-007 aliases to canonical skill names and slugs", () => {
    expect(normalizeSkill("Postgres")).toEqual({
      canonicalName: "PostgreSQL",
      slug: "postgresql",
    });
    expect(normalizeSkill("PostgreSQL")).toEqual({
      canonicalName: "PostgreSQL",
      slug: "postgresql",
    });
    expect(normalizeSkill("JS")).toEqual({
      canonicalName: "JavaScript",
      slug: "javascript",
    });
    expect(normalizeSkill("TS")).toEqual({
      canonicalName: "TypeScript",
      slug: "typescript",
    });
    expect(normalizeSkill("K8s")).toEqual({
      canonicalName: "Kubernetes",
      slug: "kubernetes",
    });
    expect(normalizeSkill("Golang")).toEqual({
      canonicalName: "Go",
      slug: "go",
    });
    expect(normalizeSkill("Tailwind")).toEqual({
      canonicalName: "Tailwind CSS",
      slug: "tailwindcss",
    });
    expect(normalizeSkill("CI/CD")).toEqual({
      canonicalName: "CI/CD",
      slug: "ci-cd",
    });
    expect(normalizeSkill("CICD")).toEqual({
      canonicalName: "CI/CD",
      slug: "ci-cd",
    });
    expect(normalizeSkill("RESTful API")).toEqual({
      canonicalName: "REST API",
      slug: "rest-api",
    });
    expect(normalizeSkill("Mongo")).toEqual({
      canonicalName: "MongoDB",
      slug: "mongodb",
    });
    expect(normalizeSkill("ReactJS")).toEqual({
      canonicalName: "React",
      slug: "react",
    });
    expect(normalizeSkill("React.js")).toEqual({
      canonicalName: "React",
      slug: "react",
    });
  });

  it("preserves unknown skills cleanly and handles empty input", () => {
    expect(normalizeSkill("Event Sourcing")).toEqual({
      canonicalName: "Event Sourcing",
      slug: "event-sourcing",
    });
    expect(normalizeSkill("   ")).toEqual({ canonicalName: "", slug: "" });
  });
});
