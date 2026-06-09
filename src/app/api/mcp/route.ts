import { NextRequest } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "@/lib/mcp/server";
import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { extractRpcInfo, logMcpRequest } from "@/lib/mcp/log";
import { consumeToken, consumeAuthFailToken } from "@/lib/mcp/rate-limit";

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
    // Throttle failed auth attempts by client IP to prevent bearer-token
    // brute-force. x-forwarded-for is set by Tailscale/reverse-proxy; fall
    // back to "unknown" so the bucket still applies (single-user self-host).
    const rawIp = request.headers.get("x-forwarded-for") ?? "unknown";
    const clientIp = rawIp.split(",")[0].trim();
    const authFailDecision = consumeAuthFailToken(clientIp);

    const status = authFailDecision.allowed ? authResult.error.status : 429;
    const body = authFailDecision.allowed
      ? authResult.error.body
      : { error: "rate_limited" };
    const extraHeaders: Record<string, string> = authFailDecision.allowed
      ? (authResult.error.headers ?? {})
      : { "Retry-After": String(authFailDecision.retryAfterSeconds) };

    const response = new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    });
    logMcpRequest({
      http_method: request.method,
      status: response.status,
      duration_ms: Date.now() - startedAt,
      outcome: authFailDecision.allowed ? "auth_failed" : "rate_limited",
      ...rpcInfo,
    });
    return response;
  }

  const { auth } = authResult.result;

  // Abuse-guard rate limit. Bucket is keyed by userId because the bearer
  // token is constant in a single-user self-host — keying by token would
  // be equivalent. Ceiling is high enough to never trip real usage.
  const decision = consumeToken(auth.userId);
  if (!decision.allowed) {
    const response = new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(decision.retryAfterSeconds),
      },
    });
    logMcpRequest({
      http_method: request.method,
      status: 429,
      duration_ms: Date.now() - startedAt,
      outcome: "rate_limited",
      user_id: auth.userId,
      client_id: auth.clientId,
      ...rpcInfo,
    });
    return response;
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
