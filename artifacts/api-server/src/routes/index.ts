import { Router } from "express";
import healthRouter from "./health.js";
import urlsRouter from "./urls.js";

const router = Router() as any;

router.use(healthRouter);
router.use(urlsRouter);

export default router;
