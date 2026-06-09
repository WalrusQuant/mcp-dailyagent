import { describe, it, expect } from "vitest";
import { readJsonBody } from "@/lib/api-body";

function makeRequest(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });
}

describe("readJsonBody", () => {
  it("returns the parsed object for valid JSON", async () => {
    const req = makeRequest('{"foo":"bar","num":42}');
    const result = await readJsonBody(req);
    expect(result).toEqual({ foo: "bar", num: 42 });
  });

  it("returns null for malformed JSON", async () => {
    const req = makeRequest("not json at all");
    const result = await readJsonBody(req);
    expect(result).toBeNull();
  });

  it("returns null for a JSON array body", async () => {
    const req = makeRequest('[1,2,3]');
    const result = await readJsonBody(req);
    expect(result).toBeNull();
  });

  it("returns null for a JSON null body", async () => {
    const req = makeRequest("null");
    const result = await readJsonBody(req);
    expect(result).toBeNull();
  });

  it("returns null for a JSON string body", async () => {
    const req = makeRequest('"just a string"');
    const result = await readJsonBody(req);
    expect(result).toBeNull();
  });

  it("returns null for a JSON number body", async () => {
    const req = makeRequest("42");
    const result = await readJsonBody(req);
    expect(result).toBeNull();
  });

  it("returns an empty object for {}", async () => {
    const req = makeRequest("{}");
    const result = await readJsonBody(req);
    expect(result).toEqual({});
  });
});
