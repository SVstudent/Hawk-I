import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tracksRouter from "./tracks";
import shodanRouter from "./shodan";
import intelRouter from "./intel";
import dashboardRouter from "./dashboard";
import ontologyRouter from "./ontology";
import chatRouter from "./chat";
import missionRouter from "./mission";
import configRouter from "./config";
import vesselsRouter from "./vessels";

const router: IRouter = Router();

router.use(healthRouter);
router.use(tracksRouter);
router.use(shodanRouter);
router.use(intelRouter);
router.use(dashboardRouter);
router.use(ontologyRouter);
router.use(chatRouter);
router.use(missionRouter);
router.use(configRouter);
router.use(vesselsRouter);

export default router;
