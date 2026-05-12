import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { extractRpcInfo, logMcpRequest } from "@/lib/mcp/log";

/**
 * MCP Server endpoint — handles all MCP communication via Streamable HTTP.
 * Auth: Bearer token must match MCP_API_KEY env var.
 * Stateless: each request is independently authenticated.
 */

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const startedAt = Date.now();

  // Best-effort read of the JSON-RPC envelope for logging. Reads from a clone
  // so the original body stream stays intact for the transport. Only the
  // method name and tool name are extracted — never arguments.
  let rpcInfo: { rpc_method?: string; tool?: string } = {};
  if (request.method === "POST") {
    try {
      const text = await request.clone().text();
      if (text) rpcInfo = extractRpcInfo(JSON.parse(text));
    } catch {
      // Malformed body — let the transport produce the user-facing error.
    }
  }

  // Authenticate
  const authHeader = request.headers.get("Authorization");
  const authResult = await authenticateMcpRequest(authHeader);

  if (!authResult.ok) {
    const response = new Response(JSON.stringify(authResult.error.body), {
      status: authResult.error.status,
      headers: {
        "Content-Type": "application/json",
        ...authResult.error.headers,
      },
    });
    logMcpRequest({
      http_method: request.method,
      status: response.status,
      duration_ms: Date.now() - startedAt,
      outcome: "auth_failed",
      ...rpcInfo,
    });
    return response;
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

  logMcpRequest({
    http_method: request.method,
    status: response.status,
    duration_ms: Date.now() - startedAt,
    outcome: response.status >= 400 ? "error" : "ok",
    user_id: auth.userId,
    client_id: auth.clientId,
    ...rpcInfo,
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
