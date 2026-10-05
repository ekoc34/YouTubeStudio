import { createInsertSchema } from "drizzle-zod";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const ideaStatusEnum = pgEnum("idea_status", [
  "NEW",
  "RESEARCHING",
  "APPROVED",
  "REJECTED",
  "SCRIPTING",
  "READY",
]);
export const ideaSourceEnum = pgEnum("idea_source", [
  "MANUAL",
  "STRATEGIST",
  "RESEARCH",
]);

export const ideasTable = pgTable("content_ideas", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  topic: text("topic").notNull(),
  hook: text("hook").notNull(),
  description: text("description").notNull(),
  targetAudience: text("target_audience").notNull(),
  format: text("format").notNull(),
  estimatedDuration: integer("estimated_duration").notNull(),
  viralScore: integer("viral_score"),
  originalityScore: integer("originality_score"),
  rationale: text("rationale"),
  weaknesses: text("weaknesses").array().notNull().default([]),
  improvements: text("improvements").array().notNull().default([]),
  opportunityScore: integer("opportunity_score"),
  researchEvidence: text("research_evidence"),
  originalityConsiderations: text("originality_considerations")
    .array()
    .notNull()
    .default([]),
  source: ideaSourceEnum("source").notNull().default("MANUAL"),
  status: ideaStatusEnum("status").notNull().default("NEW"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertIdeaSchema = createInsertSchema(ideasTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Idea = typeof ideasTable.$inferSelect;
