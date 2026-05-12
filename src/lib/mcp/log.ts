type Outcome = "ok" | "auth_failed" | "rate_limited" | "error";

export interface McpLogFields {
  http_method: string;
  status: number;
  duration_ms: number;
  outcome: Outcome;
  rpc_method?: string;
  tool?: string;
  user_id?: string;
  client_id?: string;
}

export function logMcpRequest(fields: McpLogFields): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      component: "mcp",
      ...fields,
    })
  );
}

export function extractRpcInfo(
  body: unknown
): { rpc_method?: string; tool?: string } {
  if (Array.isArray(body)) {
    return body.length > 0 ? extractRpcInfo(body[0]) : {};
  }
  if (!body || typeof body !== "object") return {};
  const o = body as Record<string, unknown>;
  const rpc_method = typeof o.method === "string" ? o.method : undefined;
  let tool: string | undefined;
  if (rpc_method === "tools/call" && o.params && typeof o.params === "object") {
    const p = o.params as Record<string, unknown>;
    if (typeof p.name === "string") tool = p.name;
  }
  return { rpc_method, tool };
}
