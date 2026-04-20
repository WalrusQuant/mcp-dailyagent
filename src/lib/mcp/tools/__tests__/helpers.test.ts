import { describe, it, expect } from "vitest";
import { getAuth, checkScope, textResult, errorResult, Extra } from "@/lib/mcp/tools/helpers";

// ---------------------------------------------------------------------------
// Helpers to build the Extra-shaped objects the handlers receive
// ---------------------------------------------------------------------------

function makeExtra(overrides: Record<string, unknown> = {}): Extra {
  return overrides as unknown as Extra;
}

function makeExtraWithAuth(userId: string, scopes: string[]): Extra {
  return makeExtra({
    authInfo: {
      extra: { userId },
      scopes,
    },
  });
}

// ---------------------------------------------------------------------------

describe("getAuth", () => {
  it("extracts userId and scopes from extra object", () => {
    const extra = makeExtraWithAuth("user-abc", ["tasks:read", "tasks:write"]);
    const auth = getAuth(extra);

    expect(auth).not.toBeNull();
    expect(auth!.userId).toBe("user-abc");
    expect(auth!.scopes).toEqual(["tasks:read", "tasks:write"]);
  });

  it("returns null when authInfo is missing", () => {
    const extra = makeExtra({});
    expect(getAuth(extra)).toBeNull();
  });

  it("returns null when userId is missing from authInfo.extra", () => {
    const extra = makeExtra({
      authInfo: {
        extra: {},
        scopes: [],
      },
    });
    expect(getAuth(extra)).toBeNull();
  });

  it("defaults scopes to empty array when not provided", () => {
    const extra = makeExtra({
      authInfo: {
        extra: { userId: "user-xyz" },
        // no scopes field
      },
    });
    const auth = getAuth(extra);
    expect(auth).not.toBeNull();
    expect(auth!.scopes).toEqual([]);
  });
});

// ---------------------------------------------------------------------------

describe("checkScope", () => {
  it("returns null when the required scope is present", () => {
    expect(checkScope(["tasks:read", "tasks:write"], "tasks:read")).toBeNull();
  });

  it("returns an error message string when the required scope is missing", () => {
    const result = checkScope(["tasks:read"], "tasks:write");
    expect(typeof result).toBe("string");
    expect(result).toContain("tasks:write");
  });

  it("returns an error message when scopes array is empty", () => {
    const result = checkScope([], "habits:read");
    expect(result).not.toBeNull();
    expect(result).toContain("habits:read");
  });

  it("is case-sensitive when matching scopes", () => {
    expect(checkScope(["Tasks:Read"], "tasks:read")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("textResult", () => {
  it("wraps data in MCP content format with type text", () => {
    const result = textResult({ id: 1, title: "Test task" });
    expect(result).toHaveProperty("content");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
  });

  it("serializes the data as JSON in the text field", () => {
    const data = { id: "abc", done: false };
    const result = textResult(data);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(data);
  });

  it("handles arrays", () => {
    const data = [{ id: 1 }, { id: 2 }];
    const result = textResult(data);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toEqual(data);
  });

  it("handles null", () => {
    const result = textResult(null);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe("errorResult", () => {
  it("wraps the message in MCP content format", () => {
    const result = errorResult("Something went wrong");
    expect(result).toHaveProperty("content");
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toBe("Something went wrong");
  });

  it("sets isError to true", () => {
    const result = errorResult("error");
    expect(result.isError).toBe(true);
  });

  it("preserves the full error message string", () => {
    const msg = "Insufficient scope: tasks:write";
    const result = errorResult(msg);
    expect(result.content[0].text).toBe(msg);
  });
});
