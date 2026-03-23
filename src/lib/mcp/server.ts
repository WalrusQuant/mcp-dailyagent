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
import { registerReviewTools } from "./tools/reviews";
import { registerPrompts } from "./prompts";

/** Create and configure the MCP server with all tools, resources, and prompts */
export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "Daily Agent",
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
  registerReviewTools(server);

  // Register prompts
  registerPrompts(server);

  return server;
}
