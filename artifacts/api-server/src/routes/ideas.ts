import { and, desc, eq, ilike, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  ideasTable,
  projectsTable,
} from "@workspace/db";
import {
  CreateIdeaBody,
  CreateIdeaResponse,
  DeleteIdeaParams,
  GetIdeaParams,
  GetIdeaResponse,
  ListIdeasQueryParams,
  ListIdeasResponse,
  UpdateIdeaBody,
  UpdateIdeaParams,
  UpdateIdeaResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/ideas", async (req, res): Promise<void> => {
  const query = ListIdeasQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const filters = [];
  if (query.data.status) {
    filters.push(eq(ideasTable.status, query.data.status));
  }
  if (query.data.q?.trim()) {
    const search = `%${query.data.q.trim()}%`;
    filters.push(
      or(
        ilike(ideasTable.title, search),
        ilike(ideasTable.topic, search),
        ilike(ideasTable.hook, search),
        ilike(ideasTable.description, search),
      )!,
    );
  }

  const ideas = await db
    .select()
    .from(ideasTable)
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(ideasTable.createdAt));

  res.json(ListIdeasResponse.parse(ideas));
});

router.post("/ideas", async (req, res): Promise<void> => {
  const body = CreateIdeaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [idea] = await db.insert(ideasTable).values(body.data).returning();
  res.status(201).json(CreateIdeaResponse.parse(idea));
});

router.get("/ideas/:id", async (req, res): Promise<void> => {
  const params = GetIdeaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [idea] = await db
    .select()
    .from(ideasTable)
    .where(eq(ideasTable.id, params.data.id))
    .limit(1);
  if (!idea) {
    res.status(404).json({ error: "Idea not found." });
    return;
  }

  res.json(GetIdeaResponse.parse(idea));
});

router.patch("/ideas/:id", async (req, res): Promise<void> => {
  const params = UpdateIdeaParams.safeParse(req.params);
  const body = UpdateIdeaBody.safeParse(req.body);
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

  const [idea] = await db
    .update(ideasTable)
    .set(body.data)
    .where(eq(ideasTable.id, params.data.id))
    .returning();
  if (!idea) {
    res.status(404).json({ error: "Idea not found." });
    return;
  }

  res.json(UpdateIdeaResponse.parse(idea));
});

router.delete("/ideas/:id", async (req, res): Promise<void> => {
  const params = DeleteIdeaParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [project] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(eq(projectsTable.ideaId, params.data.id))
    .limit(1);
  if (project) {
    res.status(409).json({
      error: "This idea is attached to a project. Delete the project first.",
    });
    return;
  }

  const [idea] = await db
    .delete(ideasTable)
    .where(eq(ideasTable.id, params.data.id))
    .returning({ id: ideasTable.id });
  if (!idea) {
    res.status(404).json({ error: "Idea not found." });
    return;
  }

  res.sendStatus(204);
});

export default router;
