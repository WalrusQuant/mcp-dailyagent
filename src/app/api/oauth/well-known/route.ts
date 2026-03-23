import { NextResponse } from "next/server";
import { VALID_SCOPES } from "@/lib/oauth-scopes";

/**
 * Protected Resource Metadata (RFC 9728).
 * Served at /.well-known/oauth-protected-resource via next.config.ts rewrite.
 *
 * This tells MCP clients (Claude Desktop, Claude Code, etc.) where to
 * authenticate — pointing them to our Hydra instance.
 */
export async function GET() {
  const hydraPublicUrl = process.env.NEXT_PUBLIC_HYDRA_PUBLIC_URL;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!hydraPublicUrl) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_HYDRA_PUBLIC_URL not configured" },
      { status: 500 }
    );
  }

  const metadata = {
    resource: appUrl ? `${appUrl}/api/mcp` : undefined,
    authorization_servers: [hydraPublicUrl],
    scopes_supported: VALID_SCOPES,
    bearer_methods_supported: ["header"],
  };

  return NextResponse.json(metadata, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
