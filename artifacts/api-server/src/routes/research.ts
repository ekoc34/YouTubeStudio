import { Router, type IRouter, type Response } from "express";
import {
  CreateResearchSessionResponse,
  GetResearchSessionParams,
  GetResearchSessionResponse,
  GetResearchVideoDetailsParams,
  GetResearchVideoDetailsResponse,
  GetResearchStatusResponse,
  ListResearchSessionsResponse,
  ResearchChannelBody,
  ResearchChannelResponse,
  SearchResearchBody,
  SearchResearchResponse,
  SearchResearchSessionParams,
  SearchResearchSessionResponse,
} from "@workspace/api-zod";
import {
  isYouTubeConfigured,
  YouTubeConfigurationError,
  YouTubeDataApiError,
  createYouTubeResearchProvider,
  YOUTUBE_DATA_SOURCE,
  validateYouTubeChannelReference,
} from "../services/youtube-research/provider";
import {
  ResearchInputError,
  ResearchSessionKindError,
  ResearchSessionNotFoundError,
  validateResearchSearchInput,
  youtubeResearchService,
} from "../services/youtube-research/research-service";
import type { ResearchSearchInput } from "@workspace/api-zod";

const router: IRouter = Router();

function sendResearchError(
  res: Response,
  error: unknown,
): void {
  if (error instanceof ResearchSessionNotFoundError) {
    res.status(404).json({ error: error.message });
    return;
  }
  if (
    error instanceof ResearchInputError ||
    error instanceof ResearchSessionKindError
  ) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (error instanceof YouTubeConfigurationError) {
    res.status(503).json({ error: error.message });
    return;
  }
  if (error instanceof YouTubeDataApiError) {
    const status = error.statusCode === 400 ? 400 : error.statusCode === 404 ? 404 : 502;
    res.status(status).json({ error: error.message });
    return;
  }
  console.error("YouTube research request failed", error);
  res.status(500).json({ error: "Research could not be completed." });
}

function normalizedSearchInput(
  value: unknown,
):
  | { success: true; data: ResearchSearchInput }
  | { success: false; errorMessage: string } {
  const parsed = SearchResearchBody.safeParse(value);
  if (!parsed.success) {
    return { success: false, errorMessage: parsed.error.message };
  }
  try {
    return {
      success: true,
      data: validateResearchSearchInput({
      ...parsed.data,
      query: parsed.data.query.trim(),
      language: parsed.data.language.trim(),
      region: parsed.data.region.trim().toUpperCase(),
      }),
    };
  } catch (error) {
    return {
      success: false,
      errorMessage:
        error instanceof Error ? error.message : "Invalid research filters.",
    };
  }
}

router.get("/research/status", (_req, res) => {
  res.json(
    GetResearchStatusResponse.parse({
      youtubeConfigured: isYouTubeConfigured(),
      aiConfigured: Boolean(process.env.OPENAI_API_KEY),
    }),
  );
});

router.get("/research/sessions", async (_req, res): Promise<void> => {
  try {
    const sessions = await youtubeResearchService.listSessions();
    res.json(ListResearchSessionsResponse.parse(sessions));
  } catch (error) {
    sendResearchError(res, error);
  }
});

router.post("/research/sessions", async (req, res): Promise<void> => {
  const body = normalizedSearchInput(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.errorMessage });
    return;
  }
  if (!isYouTubeConfigured()) {
    res.status(503).json({
      error: "YouTube Data API is not configured. Add YOUTUBE_API_KEY through Replit Secrets to enable real research.",
    });
    return;
  }

  try {
    const session = await youtubeResearchService.createSearchSession(body.data);
    res.status(201).json(CreateResearchSessionResponse.parse(session));
  } catch (error) {
    sendResearchError(res, error);
  }
});

router.post(
  "/research/sessions/:id/search",
  async (req, res): Promise<void> => {
    const params = SearchResearchSessionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!isYouTubeConfigured()) {
      res.status(503).json({
        error: "YouTube Data API is not configured. Add YOUTUBE_API_KEY through Replit Secrets to enable real research.",
      });
      return;
    }

    try {
      const detail = await youtubeResearchService.searchSession(params.data.id);
      if (!detail) {
        res.status(404).json({ error: "Research session not found." });
        return;
      }
      res.json(SearchResearchSessionResponse.parse(detail));
    } catch (error) {
      sendResearchError(res, error);
    }
  },
);

router.get("/research/sessions/:id", async (req, res): Promise<void> => {
  const params = GetResearchSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  try {
    const detail = await youtubeResearchService.getSession(params.data.id);
    if (!detail) {
      res.status(404).json({ error: "Research session not found." });
      return;
    }
    res.json(GetResearchSessionResponse.parse(detail));
  } catch (error) {
    sendResearchError(res, error);
  }
});

router.post("/research/search", async (req, res): Promise<void> => {
  const body = normalizedSearchInput(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.errorMessage });
    return;
  }
  if (!isYouTubeConfigured()) {
    res.status(503).json({
      error: "YouTube Data API is not configured. Add YOUTUBE_API_KEY through Replit Secrets to enable real research.",
    });
    return;
  }

  try {
    const detail = await youtubeResearchService.search(body.data);
    if (!detail) {
      res.status(500).json({ error: "Research session could not be loaded." });
      return;
    }
    res.status(201).json(SearchResearchResponse.parse(detail));
  } catch (error) {
    sendResearchError(res, error);
  }
});

router.get("/research/videos/:videoId", async (req, res): Promise<void> => {
  const params = GetResearchVideoDetailsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(params.data.videoId)) {
    res.status(400).json({ error: "Video ID must be an 11-character YouTube ID." });
    return;
  }
  if (!isYouTubeConfigured()) {
    res.status(503).json({
      error: "YouTube Data API is not configured. Add YOUTUBE_API_KEY through Replit Secrets to enable real research.",
    });
    return;
  }

  try {
    const [video] = await createYouTubeResearchProvider().getVideoDetails([
      params.data.videoId,
    ]);
    if (!video) {
      res.status(404).json({ error: "No public YouTube video matched that ID." });
      return;
    }
    res.json(
      GetResearchVideoDetailsResponse.parse({
        ...video,
        dataSource: YOUTUBE_DATA_SOURCE,
        retrievedAt: new Date(),
      }),
    );
  } catch (error) {
    sendResearchError(res, error);
  }
});

router.post("/research/channels", async (req, res): Promise<void> => {
  const body = ResearchChannelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  try {
    validateYouTubeChannelReference(body.data.channelUrlOrId);
  } catch (error) {
    sendResearchError(res, error);
    return;
  }
  if (!isYouTubeConfigured()) {
    res.status(503).json({
      error: "YouTube Data API is not configured. Add YOUTUBE_API_KEY through Replit Secrets to enable real research.",
    });
    return;
  }

  try {
    const detail = await youtubeResearchService.researchChannel(
      body.data.channelUrlOrId,
    );
    if (!detail) {
      res.status(500).json({ error: "Channel research could not be loaded." });
      return;
    }
    res.status(201).json(ResearchChannelResponse.parse(detail));
  } catch (error) {
    sendResearchError(res, error);
  }
});

export default router;
