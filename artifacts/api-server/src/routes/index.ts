import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import urlsRouter from "./urls.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(urlsRouter);

export default router;
