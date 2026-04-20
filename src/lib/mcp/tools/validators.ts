import { z } from "zod";

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const prioritySchema = z
  .string()
  .regex(/^[A-C][1-9]$/, "Must be A1-C9 (letter A/B/C + digit 1-9)");

export const priorityDescription =
  "Franklin Covey priority: letter + digit, like A1, B3, C9. A=critical, B=important, C=nice-to-have. The digit (1-9) is sub-ordering within the letter.";

export const goalCategorySchema = z.enum([
  "health",
  "career",
  "personal",
  "financial",
  "learning",
  "relationships",
  "other",
]);

export const goalStatusSchema = z.enum(["active", "completed", "abandoned"]);

export const spaceStatusSchema = z.enum(["active", "paused", "completed"]);

export const habitFrequencySchema = z.enum(["daily", "weekly"]);

export const exerciseTypeSchema = z.enum(["strength", "timed", "cardio"]);
