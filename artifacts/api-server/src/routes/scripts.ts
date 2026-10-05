import { desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  ideasTable,
  projectsTable,
  scenesTable,
  scriptsTable,
} from "@workspace/db";
import {
  ApproveScriptParams,
  ApproveScriptResponse,
  GenerateScriptBody,
  GenerateScriptResponse,
  GetScriptParams,
  GetScriptResponse,
  ListScriptsQueryParams,
  ListScriptsResponse,
  UpdateScriptBody,
  UpdateScriptParams,
  UpdateScriptResponse,
} from "@workspace/api-zod";
import { attachScenes } from "../lib/content-views";
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
    "Shorts script generation failed",
  );
  res.status(503).json({
    error: configurationError
      ? error.message
      : "Script generation is temporarily unavailable. Please try again.",
  });
}

router.get("/scripts", async (req, res): Promise<void> => {
  const query = ListScriptsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const scripts = await db
    .select()
    .from(scriptsTable)
    .where(
      query.data.projectId
        ? eq(scriptsTable.projectId, query.data.projectId)
        : undefined,
    )
    .orderBy(desc(scriptsTable.updatedAt));
  res.json(ListScriptsResponse.parse(await attachScenes(scripts)));
});

router.post("/scripts/generate", async (req, res): Promise<void> => {
  const body = GenerateScriptBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [idea] = await db
    .select()
    .from(ideasTable)
    .where(eq(ideasTable.id, body.data.ideaId))
    .limit(1);
  if (!idea) {
    res.status(404).json({ error: "Idea not found." });
    return;
  }

  let project: typeof projectsTable.$inferSelect | undefined;
  if (body.data.projectId) {
    [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, body.data.projectId))
      .limit(1);
    if (!project) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    if (project.ideaId !== idea.id) {
      res.status(409).json({
        error: "The selected project is linked to a different idea.",
      });
      return;
    }
  }

  try {
    const generated = await new ContentStrategist().generateShortsScript({
      title: idea.title,
      topic: idea.topic,
      hook: idea.hook,
      description: idea.description,
      targetAudience: idea.targetAudience,
      format: idea.format,
      estimatedDuration: idea.estimatedDuration,
      targetDurationSeconds: body.data.targetDurationSeconds ?? 45,
      tone: body.data.tone,
    });

    if (!project) {
      const [existingProject] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.ideaId, idea.id))
        .orderBy(desc(projectsTable.updatedAt))
        .limit(1);
      project =
        existingProject ??
        (
          await db
            .insert(projectsTable)
            .values({ ideaId: idea.id, name: idea.title })
            .returning()
        )[0];
    }

    const script = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(scriptsTable)
        .values({
          projectId: project!.id,
          ideaId: idea.id,
          hook: generated.hook,
          narration: generated.narration,
          soundMusic: generated.soundMusic,
          cta: generated.cta,
          status: "DRAFT",
        })
        .returning();

      await tx.insert(scenesTable).values(
        generated.scenes.map((scene, index) => ({
          scriptId: created.id,
          ...scene,
          sequence: index + 1,
        })),
      );
      await tx
        .update(projectsTable)
        .set({ status: "SCRIPT" })
        .where(eq(projectsTable.id, project!.id));
      await tx
        .update(ideasTable)
        .set({ status: "SCRIPTING" })
        .where(eq(ideasTable.id, idea.id));

      return created;
    });

    const [scriptWithScenes] = await attachScenes([script]);
    res
      .status(201)
      .json(GenerateScriptResponse.parse(scriptWithScenes));
  } catch (error) {
    sendAIError(req, res, error);
  }
});

router.get("/scripts/:id", async (req, res): Promise<void> => {
  const params = GetScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [script] = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.id, params.data.id))
    .limit(1);
  if (!script) {
    res.status(404).json({ error: "Script not found." });
    return;
  }

  const [scriptWithScenes] = await attachScenes([script]);
  res.json(GetScriptResponse.parse(scriptWithScenes));
});

router.patch("/scripts/:id", async (req, res): Promise<void> => {
  const params = UpdateScriptParams.safeParse(req.params);
  const body = UpdateScriptBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  if (Object.keys(body.data).length === 0) {
    res.status(400).json({ error: "Provide at least one field to update." });
    return;
  }

  const [existing] = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.id, params.data.id))
    .limit(1);
  if (!existing) {
    res.status(404).json({ error: "Script not found." });
    return;
  }
  if (existing.status !== "DRAFT") {
    res.status(409).json({ error: "Approved scripts cannot be edited." });
    return;
  }

  const { scenes, ...fields } = body.data;
  await db.transaction(async (tx) => {
    if (Object.keys(fields).length > 0) {
      await tx
        .update(scriptsTable)
        .set(fields)
        .where(eq(scriptsTable.id, existing.id));
    }
    if (scenes) {
      await tx.delete(scenesTable).where(eq(scenesTable.scriptId, existing.id));
      await tx.insert(scenesTable).values(
        scenes.map((scene, index) => ({
          scriptId: existing.id,
          ...scene,
          sequence: index + 1,
        })),
      );
    }
  });

  const [updated] = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.id, existing.id))
    .limit(1);
  const [scriptWithScenes] = await attachScenes(updated ? [updated] : []);
  res.json(UpdateScriptResponse.parse(scriptWithScenes));
});

router.post("/scripts/:id/approve", async (req, res): Promise<void> => {
  const params = ApproveScriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [script] = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.id, params.data.id))
    .limit(1);
  if (!script) {
    res.status(404).json({ error: "Script not found." });
    return;
  }
  if (script.status !== "DRAFT") {
    res.status(409).json({ error: "This script has already been approved." });
    return;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(scriptsTable)
      .set({ status: "APPROVED" })
      .where(eq(scriptsTable.id, script.id));
    await tx
      .update(projectsTable)
      .set({ status: "SCENES" })
      .where(eq(projectsTable.id, script.projectId));
    await tx
      .update(ideasTable)
      .set({ status: "READY" })
      .where(eq(ideasTable.id, script.ideaId));
  });

  const [approved] = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.id, script.id))
    .limit(1);
  const [approvedWithScenes] = await attachScenes(approved ? [approved] : []);
  res.json(ApproveScriptResponse.parse(approvedWithScenes));
});

export default router;
