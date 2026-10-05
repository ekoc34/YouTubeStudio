import { count, desc, eq, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, ideasTable, projectsTable, scriptsTable } from "@workspace/db";
import { GetDashboardResponse } from "@workspace/api-zod";
import { listProjectSummaries } from "../lib/content-views";

const router: IRouter = Router();

const ideaStatuses = [
  "NEW",
  "RESEARCHING",
  "APPROVED",
  "REJECTED",
  "SCRIPTING",
  "READY",
] as const;

const projectStatuses = [
  "IDEA",
  "RESEARCH",
  "SCRIPT",
  "SCENES",
  "MEDIA",
  "VOICE",
  "EDIT",
  "QUALITY_CHECK",
  "READY",
  "UPLOADED",
  "PUBLISHED",
  "FAILED",
] as const;

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [
    generatedIdeas,
    totalScripts,
    ideasByStatusRows,
    productionByStatusRows,
    activeProjects,
    recentProjects,
    recentIdeas,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(ideasTable)
      .where(eq(ideasTable.source, "STRATEGIST")),
    db.select({ value: count() }).from(scriptsTable),
    db
      .select({ status: ideasTable.status, value: count() })
      .from(ideasTable)
      .groupBy(ideasTable.status),
    db
      .select({ status: projectsTable.status, value: count() })
      .from(projectsTable)
      .groupBy(projectsTable.status),
    db
      .select({ value: count() })
      .from(projectsTable)
      .where(
        inArray(projectsTable.status, [
          "IDEA",
          "RESEARCH",
          "SCRIPT",
          "SCENES",
          "MEDIA",
          "VOICE",
          "EDIT",
          "QUALITY_CHECK",
        ]),
      ),
    listProjectSummaries({ limit: 5 }),
    db.select().from(ideasTable).orderBy(desc(ideasTable.createdAt)).limit(5),
  ]);

  const ideaCounts = new Map(
    ideasByStatusRows.map((row) => [row.status, Number(row.value)]),
  );
  const projectCounts = new Map(
    productionByStatusRows.map((row) => [row.status, Number(row.value)]),
  );

  const summary = {
    videosCreated: 0,
    videosPublished: 0,
    ideasGenerated: Number(generatedIdeas[0]?.value ?? 0),
    scriptsCreated: Number(totalScripts[0]?.value ?? 0),
    projectsInProduction: Number(activeProjects[0]?.value ?? 0),
    ideasByStatus: ideaStatuses.map((status) => ({
      status,
      count: ideaCounts.get(status) ?? 0,
    })),
    productionByStatus: projectStatuses.map((status) => ({
      status,
      count: projectCounts.get(status) ?? 0,
    })),
    performanceAvailable: false,
    recentPerformance: [],
    recentProjects,
    recentIdeas,
  };

  res.json(GetDashboardResponse.parse(summary));
});

export default router;
