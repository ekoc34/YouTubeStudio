export const YOUTUBE_DATA_SOURCE = "YouTube Data API v3";

export type YouTubeResearchVideo = {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  publishedAt: Date | null;
  durationSeconds: number | null;
  url: string;
  thumbnailUrl: string | null;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

export type YouTubeResearchChannel = {
  channelId: string;
  title: string;
  description: string | null;
  customUrl: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string;
};

export type YouTubeSearchVideo = Pick<
  YouTubeResearchVideo,
  "videoId" | "title" | "channelId" | "channelTitle" | "publishedAt" | "thumbnailUrl"
>;

export type YouTubeSearchInput = {
  query: string;
  region: string;
  language: string;
  publishedAfter?: string;
};

export interface YouTubeResearchProvider {
  searchVideos(input: YouTubeSearchInput): Promise<YouTubeSearchVideo[]>;
  getVideoDetails(videoIds: string[]): Promise<YouTubeResearchVideo[]>;
  getChannelDetails(channelUrlOrId: string): Promise<YouTubeResearchChannel>;
  getChannelRecentVideos(
    uploadsPlaylistId: string,
  ): Promise<YouTubeResearchVideo[]>;
  getTrendingVideos(
    region: string,
    contentType: "SHORTS" | "LONG_FORM" | "BOTH",
  ): Promise<YouTubeResearchVideo[]>;
  getRelatedVideos(
    videoId: string,
    region: string,
  ): Promise<YouTubeResearchVideo[]>;
}

export class YouTubeConfigurationError extends Error {
  constructor() {
    super(
      "YouTube Data API is not configured. Add YOUTUBE_API_KEY through Replit Secrets to enable real research.",
    );
    this.name = "YouTubeConfigurationError";
  }
}

export class YouTubeDataApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = "YouTubeDataApiError";
  }
}

type ApiErrorResponse = {
  error?: {
    message?: string;
    errors?: Array<{ reason?: string }>;
  };
};

type VideoListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelId?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    contentDetails?: { duration?: string };
    statistics?: {
      viewCount?: string;
      likeCount?: string;
      commentCount?: string;
    };
  }>;
};

type SearchListResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: VideoListResponse["items"] extends Array<infer T>
      ? T extends { snippet?: infer S }
        ? S
        : never
      : never;
  }>;
};

type ChannelListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      description?: string;
      customUrl?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
    statistics?: {
      hiddenSubscriberCount?: boolean;
      subscriberCount?: string;
      viewCount?: string;
      videoCount?: string;
    };
    contentDetails?: {
      relatedPlaylists?: { uploads?: string };
    };
  }>;
};

type PlaylistItemsResponse = {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
};

function firstThumbnail(
  thumbnails?: Record<string, { url?: string }>,
): string | null {
  return (
    thumbnails?.maxres?.url ??
    thumbnails?.high?.url ??
    thumbnails?.medium?.url ??
    thumbnails?.default?.url ??
    null
  );
}

function safeCount(value?: string): number | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function durationSeconds(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return null;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;
  return Number.isSafeInteger(total) ? total : null;
}

function validDate(value?: string): Date | null {
  if (!value) return null;
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? null : result;
}

function hasApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeConfigurationError();
  return key;
}

export function isYouTubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

export class YouTubeDataApiProvider implements YouTubeResearchProvider {
  private readonly apiKey: string;

  constructor(apiKey = hasApiKey()) {
    this.apiKey = apiKey;
  }

  private async request<T>(
    endpoint: string,
    parameters: Record<string, string>,
  ): Promise<T> {
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("key", this.apiKey);

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      throw new YouTubeDataApiError(
        error instanceof Error
          ? `YouTube Data API could not be reached: ${error.message}`
          : "YouTube Data API could not be reached.",
        502,
      );
    }

    const result = (await response.json().catch(() => ({}))) as
      | T
      | ApiErrorResponse;
    if (!response.ok) {
      const apiError = result as ApiErrorResponse;
      const reason = apiError.error?.errors?.[0]?.reason;
      const message =
        reason === "quotaExceeded" || reason === "dailyLimitExceeded"
          ? "YouTube Data API quota is exhausted. Check the Google Cloud project quota and try again later."
          : `YouTube Data API request failed (${response.status}): ${apiError.error?.message ?? "The request was rejected."}`;
      throw new YouTubeDataApiError(message, response.status);
    }

    return result as T;
  }

  async searchVideos(input: YouTubeSearchInput): Promise<YouTubeSearchVideo[]> {
    const result = await this.request<SearchListResponse>("search", {
      part: "snippet",
      type: "video",
      maxResults: "25",
      q: input.query,
      regionCode: input.region,
      relevanceLanguage: input.language,
      ...(input.publishedAfter
        ? { publishedAfter: input.publishedAfter }
        : {}),
    });

    return (result.items ?? [])
      .map((item) => {
        const id = item.id?.videoId;
        const snippet = item.snippet;
        if (!id || !snippet?.title || !snippet.channelId) return null;
        return {
          videoId: id,
          title: snippet.title,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle ?? "Unavailable",
          publishedAt: validDate(snippet.publishedAt),
          thumbnailUrl: firstThumbnail(snippet.thumbnails),
        };
      })
      .filter((item): item is YouTubeSearchVideo => item !== null);
  }

  async getVideoDetails(videoIds: string[]): Promise<YouTubeResearchVideo[]> {
    const ids = [...new Set(videoIds)].filter(Boolean).slice(0, 50);
    if (ids.length === 0) return [];

    const result = await this.request<VideoListResponse>("videos", {
      part: "snippet,contentDetails,statistics",
      id: ids.join(","),
      maxResults: String(ids.length),
    });

    return (result.items ?? [])
      .map((item) => {
        const id = item.id;
        const snippet = item.snippet;
        if (!id || !snippet?.title || !snippet.channelId) return null;
        return {
          videoId: id,
          title: snippet.title,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle ?? "Unavailable",
          publishedAt: validDate(snippet.publishedAt),
          durationSeconds: durationSeconds(item.contentDetails?.duration),
          url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
          thumbnailUrl: firstThumbnail(snippet.thumbnails),
          viewCount: safeCount(item.statistics?.viewCount),
          likeCount: safeCount(item.statistics?.likeCount),
          commentCount: safeCount(item.statistics?.commentCount),
        };
      })
      .filter((item): item is YouTubeResearchVideo => item !== null);
  }

  async getChannelDetails(
    channelUrlOrId: string,
  ): Promise<YouTubeResearchChannel> {
    const reference = parseChannelReference(channelUrlOrId);
    const result = await this.request<ChannelListResponse>("channels", {
      part: "snippet,statistics,contentDetails",
      [reference.kind]: reference.value,
      maxResults: "1",
    });
    const item = result.items?.[0];
    const uploadsPlaylistId = item?.contentDetails?.relatedPlaylists?.uploads;
    if (!item?.id || !item.snippet?.title || !uploadsPlaylistId) {
      throw new YouTubeDataApiError(
        "No public YouTube channel matched that ID or URL.",
        404,
      );
    }
    const statistics = item.statistics;

    return {
      channelId: item.id,
      title: item.snippet.title,
      description: item.snippet.description ?? null,
      customUrl: item.snippet.customUrl ?? null,
      thumbnailUrl: firstThumbnail(item.snippet.thumbnails),
      subscriberCount: statistics?.hiddenSubscriberCount
        ? null
        : safeCount(statistics?.subscriberCount),
      viewCount: safeCount(statistics?.viewCount),
      videoCount: safeCount(statistics?.videoCount),
      uploadsPlaylistId,
    };
  }

  async getChannelRecentVideos(
    uploadsPlaylistId: string,
  ): Promise<YouTubeResearchVideo[]> {
    const playlist = await this.request<PlaylistItemsResponse>(
      "playlistItems",
      {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: "25",
      },
    );
    const ids = (playlist.items ?? [])
      .map((item) => item.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));
    return this.getVideoDetails(ids);
  }

  async getTrendingVideos(
    region: string,
    contentType: "SHORTS" | "LONG_FORM" | "BOTH",
  ): Promise<YouTubeResearchVideo[]> {
    const response = await this.request<VideoListResponse>("videos", {
      part: "snippet,contentDetails,statistics",
      chart: "mostPopular",
      regionCode: region,
      maxResults: "25",
    });
    const videos = (response.items ?? [])
      .map((item) => {
        const id = item.id;
        const snippet = item.snippet;
        if (!id || !snippet?.title || !snippet.channelId) return null;
        return {
          videoId: id,
          title: snippet.title,
          channelId: snippet.channelId,
          channelTitle: snippet.channelTitle ?? "Unavailable",
          publishedAt: validDate(snippet.publishedAt),
          durationSeconds: durationSeconds(item.contentDetails?.duration),
          url: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
          thumbnailUrl: firstThumbnail(snippet.thumbnails),
          viewCount: safeCount(item.statistics?.viewCount),
          likeCount: safeCount(item.statistics?.likeCount),
          commentCount: safeCount(item.statistics?.commentCount),
        };
      })
      .filter((item): item is YouTubeResearchVideo => item !== null);
    return filterByContentType(videos, contentType);
  }

  async getRelatedVideos(
    videoId: string,
    region: string,
  ): Promise<YouTubeResearchVideo[]> {
    const [source] = await this.getVideoDetails([videoId]);
    if (!source) {
      throw new YouTubeDataApiError(
        "The source video is unavailable or private.",
        404,
      );
    }
    const matches = await this.searchVideos({
      query: source.title,
      region,
      language: "en",
    });
    const details = await this.getVideoDetails(
      matches
        .map((match) => match.videoId)
        .filter((candidateId) => candidateId !== videoId),
    );
    return details;
  }
}

export function createYouTubeResearchProvider(): YouTubeResearchProvider {
  return new YouTubeDataApiProvider();
}

export function filterByContentType(
  videos: YouTubeResearchVideo[],
  contentType: "SHORTS" | "LONG_FORM" | "BOTH",
): YouTubeResearchVideo[] {
  if (contentType === "BOTH") return videos;
  return videos.filter((video) => {
    if (video.durationSeconds == null) return false;
    return contentType === "SHORTS"
      ? video.durationSeconds <= 180
      : video.durationSeconds > 180;
  });
}

function parseChannelReference(
  input: string,
): { kind: "id" | "forHandle" | "forUsername"; value: string } {
  const value = input.trim();
  if (/^UC[\w-]{22}$/.test(value)) return { kind: "id", value };
  if (/^@[\w.-]+$/.test(value)) return { kind: "forHandle", value };

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    throw new YouTubeDataApiError(
      "Enter a YouTube channel ID or a channel URL using /channel/ID, /@handle, or /user/username.",
      400,
    );
  }
  if (!/(^|\.)youtube\.com$/i.test(url.hostname)) {
    throw new YouTubeDataApiError("Enter a YouTube channel URL.", 400);
  }

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "channel" && segments[1]) {
    return { kind: "id", value: segments[1] };
  }
  if (segments[0]?.startsWith("@")) {
    return { kind: "forHandle", value: segments[0] };
  }
  if (segments[0] === "user" && segments[1]) {
    return { kind: "forUsername", value: segments[1] };
  }
  throw new YouTubeDataApiError(
    "That channel URL format cannot be resolved by the YouTube Data API. Use a channel ID, /@handle, or /user/username URL.",
    400,
  );
}
