/**
 * Parse a JSON request body. Returns null when the body is missing,
 * malformed, or not a JSON object — callers respond 400.
 */
export async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}
