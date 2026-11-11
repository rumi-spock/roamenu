export function extractSharedMenuId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const id = parsed.hostname === "menu" ? segments[0] : segments.at(-1);
    return id ? decodeURIComponent(id) : null;
  } catch {
    return null;
  }
}