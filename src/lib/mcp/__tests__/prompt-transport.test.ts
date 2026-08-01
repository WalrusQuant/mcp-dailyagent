import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "@/lib/mcp/server";

const EXPECTED_PROMPTS = [
  "daily_planning",
  "morning_briefing",
  "end_of_day_review",
  "productivity_report",
  "habit_analysis",
  "goal_check_in",
  "weekly_trends",
  "weekly_review",
  "journal_prompt",
  "workout_suggestion",
  "goal_planning",
  "space_planning",
  "week_planning",
];

describe("MCP prompt transport", () => {
  const server = createMcpServer();
  const client = new Client({ name: "prompt-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  beforeAll(async () => {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it("advertises and lists every prompt through the MCP protocol", async () => {
    expect(client.getServerCapabilities()?.prompts).toBeDefined();

    const result = await client.listPrompts();
    expect(result.prompts.map((prompt) => prompt.name)).toEqual(EXPECTED_PROMPTS);
  });

  it("dispatches prompts/get to the registered handler", async () => {
    const result = await client.getPrompt({
      name: "daily_planning",
      arguments: {},
    });

    expect(result.messages[0].content).toMatchObject({
      type: "text",
      text: "Not authenticated",
    });
  });

  it("exposes a tool fallback for clients without prompt support", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain("load_prompt");

    const result = await client.callTool({
      name: "load_prompt",
      arguments: { name: "daily_planning" },
    });
    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: JSON.stringify({
          messages: [
            {
              role: "user",
              content: { type: "text", text: "Not authenticated" },
            },
          ],
        }),
      },
    ]);
  });

  it("validates arguments passed through the tool fallback", async () => {
    const result = await client.callTool({
      name: "load_prompt",
      arguments: { name: "productivity_report" },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("Invalid arguments for productivity_report"),
      }),
    ]);
  });
});
