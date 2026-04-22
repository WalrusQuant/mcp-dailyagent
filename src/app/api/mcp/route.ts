import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";

/**
 * MCP Server endpoint — handles all MCP communication via Streamable HTTP.
 * Auth: Bearer token must match MCP_API_KEY env var.
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

  const { auth } = authResult.result;

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
      token: "",
      clientId: auth.clientId ?? "",
      scopes: auth.scopes,
      extra: {
        userId: auth.userId,
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
