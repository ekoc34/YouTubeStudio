import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { scriptsTable } from "./scripts";

export const scenesTable = pgTable(
  "script_scenes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scriptId: uuid("script_id").notNull().references(() => scriptsTable.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    narration: text("narration").notNull(),
    visualInstructions: text("visual_instructions").notNull(),
    onScreenText: text("on_screen_text").notNull(),
    soundSuggestion: text("sound_suggestion").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("script_scenes_script_sequence_unique").on(table.scriptId, table.sequence)],
);

export const insertSceneSchema = createInsertSchema(scenesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertScene = z.infer<typeof insertSceneSchema>;
export type ScriptScene = typeof scenesTable.$inferSelect;
