import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import ideasRouter from "./ideas";
import projectsRouter from "./projects";
import scriptsRouter from "./scripts";
import strategistRouter from "./strategist";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(ideasRouter);
router.use(strategistRouter);
router.use(projectsRouter);
router.use(scriptsRouter);

export default router;
