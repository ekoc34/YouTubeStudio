import { desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  ideasTable,
  projectsTable,
  scriptsTable,
} from "@workspace/db";
import {
  CreateProjectBody,
  CreateProjectResponse,
  DeleteProjectParams,
  GetProjectParams,
  GetProjectResponse,
  ListProjectsQueryParams,
  ListProjectsResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
  UpdateProjectStatusBody,
  UpdateProjectStatusParams,
  UpdateProjectStatusResponse,
} from "@workspace/api-zod";
import { attachScenes, listProjectSummaries } from "../lib/content-views";

const router: IRouter = Router();
const supportedStatuses = new Set([
  "IDEA",
  "RESEARCH",
  "SCRIPT",
  "SCENES",
  "READY",
  "FAILED",
]);

router.get("/projects", async (req, res): Promise<void> => {
  const query = ListProjectsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const projects = await listProjectSummaries({
    status: query.data.status,
  });
  res.json(ListProjectsResponse.parse(projects));
});

router.post("/projects", async (req, res): Promise<void> => {
  const body = CreateProjectBody.safeParse(req.body);
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

  const [project] = await db
    .insert(projectsTable)
    .values({
      ideaId: idea.id,
      name: body.data.name ?? idea.title,
    })
    .returning();
  const [summary] = await listProjectSummaries({
    projectId: project.id,
    limit: 1,
  });
  res.status(201).json(CreateProjectResponse.parse(summary));
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await listProjectSummaries({
    projectId: params.data.id,
    limit: 1,
  });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const [idea] = await db
    .select()
    .from(ideasTable)
    .where(eq(ideasTable.id, project.ideaId))
    .limit(1);
  const scriptRows = await db
    .select()
    .from(scriptsTable)
    .where(eq(scriptsTable.projectId, project.id))
    .orderBy(desc(scriptsTable.updatedAt));

  res.json(
    GetProjectResponse.parse({
      project,
      idea,
      scripts: await attachScenes(scriptRows),
    }),
  );
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(req.params);
  const body = UpdateProjectBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ name: body.data.name })
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const [summary] = await listProjectSummaries({
    projectId: updated.id,
    limit: 1,
  });
  res.json(UpdateProjectResponse.parse(summary));
});

router.patch("/projects/:id/status", async (req, res): Promise<void> => {
  const params = UpdateProjectStatusParams.safeParse(req.params);
  const body = UpdateProjectStatusBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  if (!supportedStatuses.has(body.data.status)) {
    res.status(409).json({
      error:
        "That production stage is not available yet. Video, voice, editing, and publishing stages are not connected.",
    });
    return;
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ status: body.data.status })
    .where(eq(projectsTable.id, params.data.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  const [summary] = await listProjectSummaries({
    projectId: updated.id,
    limit: 1,
  });
  res.json(UpdateProjectStatusResponse.parse(summary));
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  const params = DeleteProjectParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .delete(projectsTable)
    .where(eq(projectsTable.id, params.data.id))
    .returning({ id: projectsTable.id });
  if (!project) {
    res.status(404).json({ error: "Project not found." });
    return;
  }

  res.sendStatus(204);
});

export default router;
