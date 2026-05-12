import { NextResponse } from "next/server";
import { getMcpCounts } from "@/lib/mcp/server";
import pkg from "../../../../../package.json";

/**
 * Unauthenticated diagnostic for the MCP endpoint.
 *
 * Self-hosters can curl this to confirm the server is up and which transport
 * it speaks, without needing the bearer token. The body intentionally exposes
 * no PII — only the protocol surface and counts.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    ok: true,
    transport: "streamable-http",
    ...getMcpCounts(),
    version: pkg.version,
  });
}
