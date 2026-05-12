import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractRpcInfo, logMcpRequest } from "@/lib/mcp/log";

describe("extractRpcInfo", () => {
  it("returns rpc_method for a single request", () => {
    expect(
      extractRpcInfo({ jsonrpc: "2.0", id: 1, method: "tools/list" })
    ).toEqual({ rpc_method: "tools/list" });
  });

  it("returns rpc_method and tool for tools/call", () => {
    expect(
      extractRpcInfo({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_tasks", arguments: { date: "2026-05-12" } },
      })
    ).toEqual({ rpc_method: "tools/call", tool: "list_tasks" });
  });

  it("reads the first entry of a batched request", () => {
    expect(
      extractRpcInfo([
        { jsonrpc: "2.0", id: 1, method: "tools/list" },
        { jsonrpc: "2.0", id: 2, method: "tools/call" },
      ])
    ).toEqual({ rpc_method: "tools/list" });
  });

  it("returns {} for empty or invalid bodies", () => {
    expect(extractRpcInfo(null)).toEqual({});
    expect(extractRpcInfo(undefined)).toEqual({});
    expect(extractRpcInfo([])).toEqual({});
    expect(extractRpcInfo("nope")).toEqual({});
    expect(extractRpcInfo({})).toEqual({});
  });

  it("ignores a non-string tool name on tools/call", () => {
    expect(
      extractRpcInfo({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name: 42 },
      })
    ).toEqual({ rpc_method: "tools/call" });
  });
});

describe("logMcpRequest", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("emits one JSON line with the structured fields", () => {
    logMcpRequest({
      http_method: "POST",
      status: 200,
      duration_ms: 12,
      outcome: "ok",
      rpc_method: "tools/call",
      tool: "list_tasks",
      user_id: "u-1",
      client_id: "openclaw",
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const line = logSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.component).toBe("mcp");
    expect(parsed.http_method).toBe("POST");
    expect(parsed.status).toBe(200);
    expect(parsed.duration_ms).toBe(12);
    expect(parsed.outcome).toBe("ok");
    expect(parsed.rpc_method).toBe("tools/call");
    expect(parsed.tool).toBe("list_tasks");
    expect(parsed.user_id).toBe("u-1");
    expect(parsed.client_id).toBe("openclaw");
    expect(typeof parsed.ts).toBe("string");
  });

  it("does not leak tool arguments or auth material", () => {
    logMcpRequest({
      http_method: "POST",
      status: 401,
      duration_ms: 1,
      outcome: "auth_failed",
      rpc_method: "initialize",
    });
    const line = logSpy.mock.calls[0][0] as string;
    expect(line).not.toContain("arguments");
    expect(line).not.toContain("Bearer");
    expect(line).not.toContain("Authorization");
  });
});
