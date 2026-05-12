/**
 * Drift detector — bidirectional structural cross-check between the
 * wire-format types in `src/types/database.ts` and the Drizzle tables in
 * `src/lib/db/schema.ts`.
 *
 * Catches both directions:
 *   1. A field in `database.ts` with no matching SQL column (renamed
 *      column, removed column, hallucinated field).
 *   2. A SQL column with no field in the corresponding interface (a new
 *      column got added to the schema but nobody mirrored it to the wire
 *      type).
 *
 * Does NOT attempt to generate the types — serializers still do real work
 * (Date → ISO, nullable coalescing, computed shapes). This is only a
 * structural cross-check.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { getTableColumns } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

// Interface name → schema table export. Add a row here when you add a
// new column-mirror interface. Interfaces missing from this map are
// treated as payload-only and skipped.
const INTERFACE_TO_TABLE: Record<string, keyof typeof schema> = {
  Profile: "profiles",
  Space: "spaces",
  Tag: "tags",
  Task: "tasks",
  Habit: "habits",
  HabitLog: "habitLogs",
  JournalEntry: "journalEntries",
  WorkoutTemplate: "workoutTemplates",
  WorkoutExercise: "workoutExercises",
  WorkoutLog: "workoutLogs",
  WorkoutLogExercise: "workoutLogExercises",
  FocusSession: "focusSessions",
  Goal: "goals",
  GoalProgressLog: "goalProgressLogs",
  WeeklyReview: "weeklyReviews",
  DailyBriefing: "dailyBriefings",
  InsightCache: "insightCache",
};

// Payload/JSON shapes — not derived from a table, not subject to drift check.
const PAYLOAD_ONLY = new Set(["TaskRecurrence", "WorkoutSet", "Insight"]);

// Per-interface allowlist for interface fields that don't correspond to a
// SQL column (e.g. nested joined rows, computed flags). Empty for now —
// extend as the serializer surface grows.
const COMPUTED_FIELDS: Record<string, string[]> = {};

// Per-interface allowlist for SQL columns intentionally omitted from the
// wire-format interface (e.g. internal sort orders never sent to clients).
// Add an entry to silence the reverse-drift check when the omission is
// deliberate.
const OMITTED_COLUMNS: Record<string, string[]> = {};

const databaseTsPath = path.resolve(
  __dirname,
  "..",
  "database.ts"
);

interface InterfaceFields {
  name: string;
  fields: string[];
}

function parseInterfaces(filePath: string): InterfaceFields[] {
  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf-8"),
    ts.ScriptTarget.Latest,
    true
  );
  const results: InterfaceFields[] = [];
  source.forEachChild((node) => {
    if (!ts.isInterfaceDeclaration(node)) return;
    const fields: string[] = [];
    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) {
        fields.push(member.name.text);
      }
    }
    results.push({ name: node.name.text, fields });
  });
  return results;
}

function getSqlColumnNames(tableKey: keyof typeof schema): Set<string> {
  const table = schema[tableKey] as Parameters<typeof getTableColumns>[0];
  const cols = getTableColumns(table);
  const names = new Set<string>();
  for (const key of Object.keys(cols)) {
    const col = cols[key as keyof typeof cols];
    if (col && typeof col === "object" && "name" in col && typeof col.name === "string") {
      names.add(col.name);
    }
  }
  return names;
}

describe("database.ts ↔ schema.ts drift", () => {
  const parsed = parseInterfaces(databaseTsPath);

  it("every interface is either mapped to a table or marked payload-only", () => {
    const orphans = parsed
      .map((i) => i.name)
      .filter(
        (n) => !(n in INTERFACE_TO_TABLE) && !PAYLOAD_ONLY.has(n)
      );
    expect(
      orphans,
      `database.ts has interfaces with no table mapping and not marked payload-only: ${orphans.join(", ")}.\n` +
        `Either add a row to INTERFACE_TO_TABLE in this test, or add the name to PAYLOAD_ONLY.`
    ).toEqual([]);
  });

  for (const { name, fields } of parsed) {
    if (PAYLOAD_ONLY.has(name)) continue;
    const tableKey = INTERFACE_TO_TABLE[name];
    if (!tableKey) continue;

    it(`${name} fields all exist on ${String(tableKey)} (or are allowlisted)`, () => {
      const sqlNames = getSqlColumnNames(tableKey);
      const allowlist = new Set(COMPUTED_FIELDS[name] ?? []);
      const drift = fields.filter(
        (f) => !sqlNames.has(f) && !allowlist.has(f)
      );
      expect(
        drift,
        `${name} has fields not present as SQL columns on ${String(tableKey)}: ${drift.join(", ")}.\n` +
          `Either add the column to schema.ts, fix the interface, or add the field to COMPUTED_FIELDS["${name}"] in this test.`
      ).toEqual([]);
    });

    it(`${String(tableKey)} columns are all mirrored on ${name} (or omitted on purpose)`, () => {
      const sqlNames = getSqlColumnNames(tableKey);
      const fieldSet = new Set(fields);
      const omitted = new Set(OMITTED_COLUMNS[name] ?? []);
      const missing = [...sqlNames].filter(
        (col) => !fieldSet.has(col) && !omitted.has(col)
      );
      expect(
        missing,
        `${String(tableKey)} has SQL columns not mirrored on ${name}: ${missing.join(", ")}.\n` +
          `Either add the field to the interface, or add the column name to OMITTED_COLUMNS["${name}"] in this test if it's intentionally not exposed.`
      ).toEqual([]);
    });
  }
});
