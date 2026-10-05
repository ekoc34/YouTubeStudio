import { eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, ideasTable } from "@workspace/db";
import {
  AnalyzeIdeaBody,
  AnalyzeIdeaResponse,
  GenerateIdeasBody,
  GenerateIdeasResponse,
} from "@workspace/api-zod";
import { ContentStrategist } from "../services/content-strategist";
import { AIConfigurationError } from "../services/content-strategist/provider";

const router: IRouter = Router();

function sendAIError(
  req: Request,
  res: Response,
  error: unknown,
): void {
  const configurationError = error instanceof AIConfigurationError;
  req.log.error(
    { errorName: error instanceof Error ? error.name : "UnknownError" },
    "Content strategist request failed",
  );
  res.status(503).json({
    error: configurationError
      ? error.message
      : "The content strategist is temporarily unavailable. Please try again.",
  });
}

router.post("/strategist/ideas", async (req, res): Promise<void> => {
  const body = GenerateIdeasBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  try {
    const strategist = new ContentStrategist();
    const generated = await strategist.generateIdeas({
      ...body.data,
      count: body.data.count ?? 4,
    });
    const saved = await db
      .insert(ideasTable)
      .values(
        generated.map((idea) => ({
          ...idea,
          source: "STRATEGIST" as const,
          status: "NEW" as const,
        })),
      )
      .returning();
    res.status(201).json(GenerateIdeasResponse.parse(saved));
  } catch (error) {
    sendAIError(req, res, error);
  }
});

router.post("/strategist/analyze", async (req, res): Promise<void> => {
  const body = AnalyzeIdeaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  let storedIdea: typeof ideasTable.$inferSelect | undefined;
  if (body.data.ideaId) {
    [storedIdea] = await db
      .select()
      .from(ideasTable)
      .where(eq(ideasTable.id, body.data.ideaId))
      .limit(1);
    if (!storedIdea) {
      res.status(404).json({ error: "Idea not found." });
      return;
    }
  }

  const title = body.data.title ?? storedIdea?.title;
  const topic = body.data.topic ?? storedIdea?.topic;
  const hook = body.data.hook ?? storedIdea?.hook;
  const description =
    body.data.description ?? storedIdea?.description ?? "";
  const targetAudience =
    body.data.targetAudience ?? storedIdea?.targetAudience;
  const format = body.data.format ?? storedIdea?.format;
  const estimatedDuration =
    body.data.estimatedDuration ?? storedIdea?.estimatedDuration ?? 45;
  if (!title || !topic || !hook || !targetAudience || !format) {
    res.status(400).json({
      error: "Provide a saved idea ID or the complete idea details to analyze.",
    });
    return;
  }

  try {
    const analysis = await new ContentStrategist().analyzeIdea({
      title,
      topic,
      hook,
      description,
      targetAudience,
      format,
      estimatedDuration,
    });

    if (storedIdea) {
      await db
        .update(ideasTable)
        .set({
          viralScore: analysis.viralScore,
          originalityScore: analysis.originalityScore,
          rationale: analysis.explanation,
          weaknesses: analysis.weaknesses,
          improvements: analysis.improvements,
        })
        .where(eq(ideasTable.id, storedIdea.id));
    }

    res.json(AnalyzeIdeaResponse.parse(analysis));
  } catch (error) {
    sendAIError(req, res, error);
  }
});

export default router;
