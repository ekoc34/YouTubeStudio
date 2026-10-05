import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { ideasTable } from "./ideas";

export const researchSessionKindEnum = pgEnum("research_session_kind", [
  "SEARCH",
  "POPULAR",
  "CHANNEL",
]);
export const researchSessionStatusEnum = pgEnum("research_session_status", [
  "RUNNING",
  "COMPLETED",
  "FAILED",
]);
export const researchAnalysisKindEnum = pgEnum("research_analysis_kind", [
  "TREND",
  "CHANNEL",
]);
export const researchConfidenceEnum = pgEnum("research_confidence", [
  "LOW",
  "MEDIUM",
  "HIGH",
]);
export const competitionLevelEnum = pgEnum("competition_level", [
  "LOW",
  "MEDIUM",
  "HIGH",
  "UNKNOWN",
]);

export type ResearchFilters = {
  language: string | null;
  region: string | null;
  contentType: "SHORTS" | "LONG_FORM" | "BOTH";
  timeRange: "TODAY" | "WEEK" | "MONTH" | "CUSTOM" | "ALL_TIME";
  startDate: string | null;
  endDate: string | null;
};

export const researchSessionsTable = pgTable(
  "research_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: researchSessionKindEnum("kind").notNull(),
    query: text("query").notNull(),
    filters: jsonb("filters").$type<ResearchFilters>().notNull(),
    status: researchSessionStatusEnum("status").notNull().default("RUNNING"),
    resultCount: integer("result_count").notNull().default(0),
    dataSource: text("data_source").notNull().default("YouTube Data API"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }),
  },
  (table) => [index("research_sessions_created_at_idx").on(table.createdAt)],
);

export const researchVideosTable = pgTable(
  "research_videos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => researchSessionsTable.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    title: text("title").notNull(),
    channelId: text("channel_id").notNull(),
    channelTitle: text("channel_title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    durationSeconds: integer("duration_seconds"),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    viewCount: bigint("view_count", { mode: "number" }),
    likeCount: bigint("like_count", { mode: "number" }),
    commentCount: bigint("comment_count", { mode: "number" }),
    dataSource: text("data_source").notNull().default("YouTube Data API"),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_videos_session_video_idx").on(
      table.sessionId,
      table.videoId,
    ),
    index("research_videos_video_id_idx").on(table.videoId),
  ],
);

export const researchChannelsTable = pgTable(
  "research_channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => researchSessionsTable.id, { onDelete: "cascade" }),
    channelId: text("channel_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    customUrl: text("custom_url"),
    thumbnailUrl: text("thumbnail_url"),
    subscriberCount: bigint("subscriber_count", { mode: "number" }),
    viewCount: bigint("view_count", { mode: "number" }),
    videoCount: bigint("video_count", { mode: "number" }),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_channels_session_idx").on(table.sessionId),
    index("research_channels_channel_id_idx").on(table.channelId),
  ],
);

export const researchAnalysesTable = pgTable(
  "research_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => researchSessionsTable.id, { onDelete: "cascade" }),
    kind: researchAnalysisKindEnum("kind").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("research_analyses_session_kind_idx").on(
      table.sessionId,
      table.kind,
    ),
  ],
);

export const contentOpportunitiesTable = pgTable(
  "content_opportunities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => researchSessionsTable.id, { onDelete: "cascade" }),
    topic: text("topic").notNull(),
    evidence: text("evidence").notNull(),
    whyInteresting: text("why_interesting").notNull(),
    competitionLevel: competitionLevelEnum("competition_level").notNull(),
    suggestedFormat: text("suggested_format").notNull(),
    suggestedHook: text("suggested_hook").notNull(),
    potentialScore: integer("potential_score").notNull(),
    scoreReason: text("score_reason").notNull(),
    confidence: researchConfidenceEnum("confidence").notNull(),
    originalityConsiderations: text("originality_considerations")
      .array()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("content_opportunities_session_idx").on(table.sessionId),
  ],
);

export const researchSourcesTable = pgTable(
  "research_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    researchVideoId: uuid("research_video_id").references(
      () => researchVideosTable.id,
      { onDelete: "set null" },
    ),
    opportunityId: uuid("opportunity_id").references(
      () => contentOpportunitiesTable.id,
      { onDelete: "cascade" },
    ),
    ideaId: uuid("idea_id").references(() => ideasTable.id, {
      onDelete: "cascade",
    }),
    videoId: text("video_id"),
    title: text("title").notNull(),
    channelId: text("channel_id"),
    channelTitle: text("channel_title").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    url: text("url").notNull(),
    viewCount: bigint("view_count", { mode: "number" }),
    likeCount: bigint("like_count", { mode: "number" }),
    commentCount: bigint("comment_count", { mode: "number" }),
    dataSource: text("data_source").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check(
      "research_sources_single_parent_check",
      sql`num_nonnulls(${table.opportunityId}, ${table.ideaId}) = 1`,
    ),
    index("research_sources_idea_idx").on(table.ideaId),
    index("research_sources_opportunity_idx").on(table.opportunityId),
  ],
);

export type ResearchSession = typeof researchSessionsTable.$inferSelect;
export type ResearchVideo = typeof researchVideosTable.$inferSelect;
export type ResearchChannel = typeof researchChannelsTable.$inferSelect;
export type ResearchAnalysis = typeof researchAnalysesTable.$inferSelect;
export type ContentOpportunity =
  typeof contentOpportunitiesTable.$inferSelect;
export type ResearchSource = typeof researchSourcesTable.$inferSelect;
