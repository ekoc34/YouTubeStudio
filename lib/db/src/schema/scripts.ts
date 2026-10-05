import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { ideasTable } from "./ideas";
import { projectsTable } from "./projects";

export const scriptStatusEnum = pgEnum("script_status", ["DRAFT", "APPROVED"]);

export const scriptsTable = pgTable("shorts_scripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  ideaId: uuid("idea_id").notNull().references(() => ideasTable.id, { onDelete: "restrict" }),
  hook: text("hook").notNull(),
  narration: text("narration").notNull(),
  soundMusic: text("sound_music").notNull(),
  cta: text("cta").notNull(),
  status: scriptStatusEnum("status").notNull().default("DRAFT"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertScriptSchema = createInsertSchema(scriptsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertScript = z.infer<typeof insertScriptSchema>;
export type ShortsScript = typeof scriptsTable.$inferSelect;
