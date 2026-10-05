import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, ideasTable, projectsTable, scenesTable, scriptsTable } from "@workspace/db";

export async function attachScenes(
  scripts: (typeof scriptsTable.$inferSelect)[],
) {
  if (scripts.length === 0) return [];

  const scriptIds = scripts.map((script) => script.id);
  const scenes = await db
    .select()
    .from(scenesTable)
    .where(inArray(scenesTable.scriptId, scriptIds))
    .orderBy(asc(scenesTable.scriptId), asc(scenesTable.sequence));
  const scenesByScript = new Map<string, typeof scenes>();

  for (const scene of scenes) {
    const current = scenesByScript.get(scene.scriptId) ?? [];
    current.push(scene);
    scenesByScript.set(scene.scriptId, current);
  }

  return scripts.map((script) => ({
    ...script,
    scenes: scenesByScript.get(script.id) ?? [],
  }));
}

export async function listProjectSummaries(options?: {
  status?: (typeof projectsTable.$inferSelect)["status"];
  projectId?: string;
  limit?: number;
}) {
  const projects = await db
    .select({
      id: projectsTable.id,
      ideaId: projectsTable.ideaId,
      name: projectsTable.name,
      status: projectsTable.status,
      ideaTitle: ideasTable.title,
      scriptCount: sql<number>`count(${scriptsTable.id})::int`,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    })
    .from(projectsTable)
    .innerJoin(ideasTable, eq(projectsTable.ideaId, ideasTable.id))
    .leftJoin(scriptsTable, eq(scriptsTable.projectId, projectsTable.id))
    .where(
      and(
        options?.status ? eq(projectsTable.status, options.status) : undefined,
        options?.projectId
          ? eq(projectsTable.id, options.projectId)
          : undefined,
      ),
    )
    .groupBy(projectsTable.id, ideasTable.title)
    .orderBy(desc(projectsTable.updatedAt))
    .limit(options?.limit ?? 100);

  return projects.map((project) => ({
    ...project,
    scriptCount: Number(project.scriptCount),
  }));
}
