import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskResources } from "./resources/tasks";
import { registerHabitResources } from "./resources/habits";
import { registerJournalResources } from "./resources/journal";
import { registerWorkoutResources } from "./resources/workouts";
import { registerFocusResources } from "./resources/focus";
import { registerGoalResources } from "./resources/goals";
import { registerSpaceResources } from "./resources/spaces";
import { registerCalendarResources } from "./resources/calendar";
import { registerDashboardResources } from "./resources/dashboard";
import { registerBriefingResources } from "./resources/briefings";
import { registerReviewResources } from "./resources/reviews";
import { registerTaskTools } from "./tools/tasks";
import { registerHabitTools } from "./tools/habits";
import { registerJournalTools } from "./tools/journal";
import { registerWorkoutTools } from "./tools/workouts";
import { registerFocusTools } from "./tools/focus";
import { registerGoalTools } from "./tools/goals";
import { registerSpaceTools } from "./tools/spaces";
import { registerCalendarTools } from "./tools/calendar";
import { registerBriefingTools } from "./tools/briefings";
import { registerInsightTools } from "./tools/insights";
import { registerReviewTools } from "./tools/reviews";
import { registerPrompts } from "./prompts";

/**
 * Cached count of registered tools/prompts/resources, built once on first call.
 * Used by the /api/mcp/health endpoint so callers can see how much surface the
 * server exposes without round-tripping a full MCP tools/list.
 */
let cachedCounts: { tools: number; prompts: number; resources: number } | null = null;

export function getMcpCounts(): { tools: number; prompts: number; resources: number } {
  if (cachedCounts) return cachedCounts;
  const server = createMcpServer();
  // McpServer keeps these as private fields; we read them as plain props
  // because TS `private` is compile-time only. If the SDK ever renames them,
  // the server-counts test fails loudly so the rename is caught here.
  const s = server as unknown as {
    _registeredTools?: Record<string, unknown>;
    _registeredPrompts?: Record<string, unknown>;
    _registeredResources?: Record<string, unknown>;
  };
  cachedCounts = {
    tools: Object.keys(s._registeredTools ?? {}).length,
    prompts: Object.keys(s._registeredPrompts ?? {}).length,
    resources: Object.keys(s._registeredResources ?? {}).length,
  };
  return cachedCounts;
}

/** Create and configure the MCP server with all tools, resources, and prompts */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "Daily Agent MCP",
      version: "1.0.0",
    },
    {
      capabilities: {
        resources: {},
        tools: {},
        prompts: {},
      },
    }
  );

  // Register all resources
  registerTaskResources(server);
  registerHabitResources(server);
  registerJournalResources(server);
  registerWorkoutResources(server);
  registerFocusResources(server);
  registerGoalResources(server);
  registerSpaceResources(server);
  registerCalendarResources(server);
  registerDashboardResources(server);
  registerBriefingResources(server);
  registerReviewResources(server);

  // Register all tools
  registerTaskTools(server);
  registerHabitTools(server);
  registerJournalTools(server);
  registerWorkoutTools(server);
  registerFocusTools(server);
  registerGoalTools(server);
  registerSpaceTools(server);
  registerCalendarTools(server);
  registerBriefingTools(server);
  registerInsightTools(server);
  registerReviewTools(server);

  // Register prompts
  registerPrompts(server);

  return server;
}
