/** Allow only http/https URLs for external anchors rendered from persisted records. */
export function toSafeExternalHref(
  rawUrl: string | null | undefined,
): string {
  if (!rawUrl) return "#";
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "#";
  } catch {
    return "#";
  }
}
