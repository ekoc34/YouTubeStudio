import { desc, eq, sql } from "drizzle-orm";
import {
  db,
  researchChannelsTable,
  researchSessionsTable,
  researchVideosTable,
  type ResearchFilters,
} from "@workspace/db";
import type { ResearchSearchInput } from "@workspace/api-zod";
import {
  createYouTubeResearchProvider,
  filterByContentType,
  YOUTUBE_DATA_SOURCE,
  type YouTubeResearchProvider,
  type YouTubeResearchVideo,
} from "./provider";

const HISTORY_LIMIT = 25;
const SHORTS_MAX_SECONDS = 180;

export class ResearchInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResearchInputError";
  }
}

export class ResearchSessionNotFoundError extends Error {
  constructor() {
    super("Research session not found.");
    this.name = "ResearchSessionNotFoundError";
  }
}

export class ResearchSessionKindError extends Error {
  constructor() {
    super("Only topic-search sessions can be searched.");
    this.name = "ResearchSessionKindError";
  }
}

type DateWindow = {
  publishedAfter?: string;
  publishedBefore?: string;
  startMs?: number;
  endExclusiveMs?: number;
};

function dateFromFilter(value: string | null, label: string): Date {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ResearchInputError(`A valid ${label} is required for custom dates.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new ResearchInputError(`A valid ${label} is required for custom dates.`);
  }
  return parsed;
}

function getDateWindow(
  filters: ResearchFilters,
  now = new Date(),
): DateWindow {
  let start: Date | undefined;
  let endExclusive: Date | undefined;

  switch (filters.timeRange) {
    case "TODAY":
      start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      break;
    case "WEEK":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "MONTH": {
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    }
    case "CUSTOM": {
      start = dateFromFilter(filters.startDate, "start date");
      const end = dateFromFilter(filters.endDate, "end date");
      if (end < start) {
        throw new ResearchInputError("End date must be on or after the start date.");
      }
      endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);
      break;
    }
    case "ALL_TIME":
      return {};
  }

  return {
    ...(start ? { publishedAfter: start.toISOString(), startMs: start.getTime() } : {}),
    ...(endExclusive
      ? {
          publishedBefore: endExclusive.toISOString(),
          endExclusiveMs: endExclusive.getTime(),
        }
      : {}),
  };
}

function normalizeInput(input: ResearchSearchInput): ResearchSearchInput {
  const query = input.query.trim();
  const language = input.language.trim();
  const region = input.region.trim().toUpperCase();
  if (!query) throw new ResearchInputError("Enter a topic or search phrase.");
  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(language)) {
    throw new ResearchInputError("Enter a valid language code.");
  }
  if (!/^[A-Z]{2}$/.test(region)) {
    throw new ResearchInputError("Region must be a two-letter country code.");
  }
  if (
    input.timeRange === "CUSTOM" &&
    (!input.startDate || !input.endDate)
  ) {
    throw new ResearchInputError("Choose both a start date and an end date.");
  }
  if (
    input.timeRange === "CUSTOM" &&
    input.startDate &&
    input.endDate &&
    input.endDate < input.startDate
  ) {
    throw new ResearchInputError("End date must be on or after the start date.");
  }
  return { ...input, query, language, region };
}

export function validateResearchSearchInput(
  input: ResearchSearchInput,
): ResearchSearchInput {
  return normalizeInput(input);
}

function filtersFromInput(input: ResearchSearchInput): ResearchFilters {
  return {
    language: input.language,
    region: input.region,
    contentType: input.contentType,
    timeRange: input.timeRange,
    startDate: input.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: input.endDate?.toISOString().slice(0, 10) ?? null,
  };
}

function shouldIncludeByDate(
  video: YouTubeResearchVideo,
  window: DateWindow,
): boolean {
  if (window.startMs == null && window.endExclusiveMs == null) return true;
  if (!video.publishedAt) return false;
  const timestamp = video.publishedAt.getTime();
  return (
    (window.startMs == null || timestamp >= window.startMs) &&
    (window.endExclusiveMs == null || timestamp < window.endExclusiveMs)
  );
}

function orderLikeSearchResults(
  searchIds: string[],
  details: YouTubeResearchVideo[],
): YouTubeResearchVideo[] {
  const byId = new Map(details.map((video) => [video.videoId, video]));
  return searchIds.flatMap((id) => {
    const video = byId.get(id);
    return video ? [video] : [];
  });
}

function storedVideoValues(
  sessionId: string,
  video: YouTubeResearchVideo,
  retrievedAt: Date,
) {
  return {
    sessionId,
    videoId: video.videoId,
    title: video.title,
    channelId: video.channelId,
    channelTitle: video.channelTitle,
    publishedAt: video.publishedAt,
    durationSeconds: video.durationSeconds,
    url: video.url,
    thumbnailUrl: video.thumbnailUrl,
    viewCount: video.viewCount,
    likeCount: video.likeCount,
    commentCount: video.commentCount,
    dataSource: YOUTUBE_DATA_SOURCE,
    retrievedAt,
  };
}

async function storeVideos(
  sessionId: string,
  videos: YouTubeResearchVideo[],
  retrievedAt: Date,
): Promise<void> {
  if (videos.length === 0) return;
  await db
    .insert(researchVideosTable)
    .values(videos.map((video) => storedVideoValues(sessionId, video, retrievedAt)))
    .onConflictDoUpdate({
      target: [researchVideosTable.sessionId, researchVideosTable.videoId],
      set: {
        title: sql`excluded.title`,
        channelId: sql`excluded.channel_id`,
        channelTitle: sql`excluded.channel_title`,
        publishedAt: sql`excluded.published_at`,
        durationSeconds: sql`excluded.duration_seconds`,
        url: sql`excluded.url`,
        thumbnailUrl: sql`excluded.thumbnail_url`,
        viewCount: sql`excluded.view_count`,
        likeCount: sql`excluded.like_count`,
        commentCount: sql`excluded.comment_count`,
        dataSource: sql`excluded.data_source`,
        retrievedAt: sql`excluded.retrieved_at`,
      },
    });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 500);
  }
  return "Research could not be completed.";
}

export class YouTubeResearchService {
  constructor(
    private readonly providerFactory: () => YouTubeResearchProvider =
      createYouTubeResearchProvider,
  ) {}

  async createSearchSession(input: ResearchSearchInput) {
    const normalized = normalizeInput(input);
    const [session] = await db
      .insert(researchSessionsTable)
      .values({
        kind: "SEARCH",
        query: normalized.query,
        filters: filtersFromInput(normalized),
        status: "RUNNING",
        resultCount: 0,
        dataSource: YOUTUBE_DATA_SOURCE,
        updatedAt: new Date(),
      })
      .returning();
    return session;
  }

  async search(input: ResearchSearchInput) {
    const session = await this.createSearchSession(input);
    return this.searchSession(session.id);
  }

  async searchSession(sessionId: string) {
    const [session] = await db
      .select()
      .from(researchSessionsTable)
      .where(eq(researchSessionsTable.id, sessionId))
      .limit(1);

    if (!session) throw new ResearchSessionNotFoundError();
    if (session.kind !== "SEARCH") throw new ResearchSessionKindError();

    const startedAt = new Date();
    await db
      .update(researchSessionsTable)
      .set({ status: "RUNNING", errorMessage: null, updatedAt: startedAt })
      .where(eq(researchSessionsTable.id, sessionId));

    try {
      const filters = session.filters;
      const window = getDateWindow(filters);
      const provider = this.providerFactory();
      const matches = await provider.searchVideos({
        query: session.query,
        language: filters.language ?? "en",
        region: filters.region ?? "US",
        ...(window.publishedAfter
          ? { publishedAfter: window.publishedAfter }
          : {}),
        ...(window.publishedBefore
          ? { publishedBefore: window.publishedBefore }
          : {}),
      });
      const details = await provider.getVideoDetails(
        matches.map((video) => video.videoId),
      );
      const dateFiltered = orderLikeSearchResults(
        matches.map((video) => video.videoId),
        details,
      ).filter((video) => shouldIncludeByDate(video, window));
      const videos = filterByContentType(
        dateFiltered,
        filters.contentType,
      );
      const retrievedAt = new Date();

      await storeVideos(sessionId, videos, retrievedAt);
      await db
        .update(researchSessionsTable)
        .set({
          status: "COMPLETED",
          resultCount: videos.length,
          retrievedAt,
          updatedAt: retrievedAt,
          errorMessage: null,
        })
        .where(eq(researchSessionsTable.id, sessionId));

      return this.getSession(sessionId);
    } catch (error) {
      await db
        .update(researchSessionsTable)
        .set({
          status: "FAILED",
          errorMessage: errorMessage(error),
          updatedAt: new Date(),
        })
        .where(eq(researchSessionsTable.id, sessionId));
      throw error;
    }
  }

  async listSessions() {
    return db
      .select()
      .from(researchSessionsTable)
      .orderBy(desc(researchSessionsTable.createdAt))
      .limit(HISTORY_LIMIT);
  }

  async getSession(sessionId: string) {
    const [session] = await db
      .select()
      .from(researchSessionsTable)
      .where(eq(researchSessionsTable.id, sessionId))
      .limit(1);
    if (!session) return null;

    const [videos, channels] = await Promise.all([
      db
        .select()
        .from(researchVideosTable)
        .where(eq(researchVideosTable.sessionId, sessionId))
        .orderBy(desc(researchVideosTable.retrievedAt)),
      db
        .select()
        .from(researchChannelsTable)
        .where(eq(researchChannelsTable.sessionId, sessionId))
        .limit(1),
    ]);
    const channel = channels[0];
    const viewCounts = videos.flatMap((video) =>
      video.viewCount == null ? [] : [video.viewCount],
    );
    const averageRecentViews =
      viewCounts.length > 0
        ? viewCounts.reduce((total, views) => total + views, 0) /
          viewCounts.length
        : null;

    return {
      session,
      videos,
      channel: channel
        ? {
            ...channel,
            averageRecentViews,
            averageViewsSampleSize: viewCounts.length,
          }
        : null,
      trendAnalysis: null,
      channelAnalysis: null,
      opportunities: [],
    };
  }

  async researchChannel(channelUrlOrId: string) {
    const reference = channelUrlOrId.trim();
    if (reference.length < 3 || reference.length > 300) {
      throw new ResearchInputError("Enter a valid YouTube channel ID or URL.");
    }
    const createdAt = new Date();
    const [session] = await db
      .insert(researchSessionsTable)
      .values({
        kind: "CHANNEL",
        query: reference,
        filters: {
          language: "en",
          region: "US",
          contentType: "BOTH",
          timeRange: "ALL_TIME",
          startDate: null,
          endDate: null,
        },
        status: "RUNNING",
        resultCount: 0,
        dataSource: YOUTUBE_DATA_SOURCE,
        updatedAt: createdAt,
      })
      .returning();

    try {
      const provider = this.providerFactory();
      const channel = await provider.getChannelDetails(reference);
      const videos = await provider.getChannelRecentVideos(
        channel.uploadsPlaylistId,
      );
      const retrievedAt = new Date();

      await db.insert(researchChannelsTable).values({
        sessionId: session.id,
        channelId: channel.channelId,
        title: channel.title,
        description: channel.description,
        customUrl: channel.customUrl,
        thumbnailUrl: channel.thumbnailUrl,
        subscriberCount: channel.subscriberCount,
        viewCount: channel.viewCount,
        videoCount: channel.videoCount,
        retrievedAt,
      });
      await storeVideos(session.id, videos, retrievedAt);
      await db
        .update(researchSessionsTable)
        .set({
          status: "COMPLETED",
          resultCount: videos.length,
          retrievedAt,
          updatedAt: retrievedAt,
          errorMessage: null,
        })
        .where(eq(researchSessionsTable.id, session.id));

      return this.getSession(session.id);
    } catch (error) {
      await db
        .update(researchSessionsTable)
        .set({
          status: "FAILED",
          errorMessage: errorMessage(error),
          updatedAt: new Date(),
        })
        .where(eq(researchSessionsTable.id, session.id));
      throw error;
    }
  }
}

export const youtubeResearchService = new YouTubeResearchService();
