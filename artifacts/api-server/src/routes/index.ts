import { Router, type IRouter } from "express";
import healthRouter from "./health";
import weatherRouter from "./weather";
import cropsRouter from "./crops";
import marketRouter from "./market";
import dashboardRouter from "./dashboard";
import openaiRouter from "./openai";
import geoRouter from "./geo";
import psgcRouter from "./psgc";

const router: IRouter = Router();

router.use(healthRouter);
router.use(weatherRouter);
router.use(cropsRouter);
router.use(marketRouter);
router.use(dashboardRouter);
router.use(openaiRouter);
router.use(geoRouter);
router.use(psgcRouter);

export default router;
