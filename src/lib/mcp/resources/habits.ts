import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { db } from "@/lib/db/client";
import { getAuth } from "@/lib/mcp/tools/helpers";
import {
  getHabitsWithTodayStatus,
  getHabits,
  getHabitStats,
  type Habit,
} from "@/lib/mcp/queries/habits";
import type { Extra } from "@/lib/mcp/tools/helpers";

export function registerHabitResources(server: McpServer) {
  // --- habits-today ---
  server.resource(
    "habits-today",
    "dailyagent://habits/today",
    { description: "All active habits with today's completion status" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("habits:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: habits:read" }],
        };
      }

      const result = await getHabitsWithTodayStatus(db, auth.userId);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(result.data ?? []),
          },
        ],
      };
    }
  );

  // --- habits-streaks ---
  server.resource(
    "habits-streaks",
    "dailyagent://habits/streaks",
    { description: "Streak and completion rate stats for all active habits (last 30 days)" },
    async (uri, extra: Extra) => {
      const auth = getAuth(extra);
      if (!auth) return { contents: [] };

      if (!auth.scopes.includes("habits:read")) {
        return {
          contents: [{ uri: uri.href, mimeType: "text/plain", text: "Insufficient scope: habits:read" }],
        };
      }

      const habitsResult = await getHabits(db, auth.userId);
      if (!habitsResult.data) {
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify([]),
            },
          ],
        };
      }

      const statsResults = await Promise.all(
        habitsResult.data.map((habit: Habit) =>
          getHabitStats(db, auth.userId, habit.id)
        )
      );

      const stats = statsResults
        .filter((r) => r.data !== null)
        .map((r) => r.data);

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(stats),
          },
        ],
      };
    }
  );
}
