import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";

/**
 * MCP Server endpoint — handles all MCP communication via Streamable HTTP.
 * Auth: Bearer token (OAuth via Hydra or API key with da_sk_ prefix).
 * Stateless: each request is independently authenticated.
 */

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  // Authenticate
  const authHeader = request.headers.get("Authorization");
  const authResult = await authenticateMcpRequest(authHeader);

  if (!authResult.ok) {
    return new Response(JSON.stringify(authResult.error.body), {
      status: authResult.error.status,
      headers: {
        "Content-Type": "application/json",
        ...authResult.error.headers,
      },
    });
  }

  const { auth, plan } = authResult.result;

  // Rate limit
  const retryAfter = checkMcpRateLimit(auth.userId, plan);
  if (retryAfter !== null) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  // Create stateless transport and server per request
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
    enableJsonResponse: true,
  });

  const server = createMcpServer();

  await server.connect(transport);

  // Pass auth info so tool/resource handlers can access userId and scopes
  const response = await transport.handleRequest(request, {
    authInfo: {
      token: authHeader?.replace(/^Bearer\s+/i, "") ?? "",
      clientId: auth.clientId ?? "",
      scopes: auth.scopes,
      extra: {
        userId: auth.userId,
        plan,
        authMethod: auth.authMethod,
      },
    },
  });

  // Clean up after response is sent
  // Use waitUntil-like pattern: close after response streams
  response.clone().body?.pipeTo(new WritableStream()).finally(() => {
    server.close().catch(() => {});
  });

  return response;
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}
