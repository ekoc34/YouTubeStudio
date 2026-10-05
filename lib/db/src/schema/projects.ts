import { createInsertSchema } from "drizzle-zod";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { ideasTable } from "./ideas";

export const projectStatusEnum = pgEnum("project_status", [
  "IDEA",
  "RESEARCH",
  "SCRIPT",
  "SCENES",
  "MEDIA",
  "VOICE",
  "EDIT",
  "QUALITY_CHECK",
  "READY",
  "UPLOADED",
  "PUBLISHED",
  "FAILED",
]);

export const projectsTable = pgTable("content_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ideaId: uuid("idea_id").notNull().references(() => ideasTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  status: projectStatusEnum("status").notNull().default("IDEA"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ContentProject = typeof projectsTable.$inferSelect;
