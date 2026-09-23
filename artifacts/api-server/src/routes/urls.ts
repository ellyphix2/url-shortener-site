import { Router, type IRouter, type Request, type Response } from "express";
import {
  CreateUrlBody,
  CreateUrlResponse,
  GetUrlParams,
  GetUrlResponse,
} from "@workspace/api-zod";
import { prisma } from "../lib/prisma.js";
import { createRateLimiter } from "../lib/rate-limit.js";
import { createWithUniqueCode } from "../lib/short-code.js";
import { normalizeUrl } from "../lib/url-validation.js";

const router: IRouter = Router();
const allowCreation = createRateLimiter(10, 60 * 60 * 1000);

function safeError(req: Request, res: Response, error: unknown): void {
  req.log.error({ err: error }, "URL database operation failed");
  res.status(500).json({ error: "Something went wrong. Please try again later." });
}

router.post("/urls", async (req, res): Promise<void> => {
  if (!allowCreation(req.ip ?? "unknown")) {
    res.status(429).json({ error: "You've reached the hourly limit. Please try again later." });
    return;
  }

  const body = CreateUrlBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Enter a URL, up to 2048 characters." });
    return;
  }
  const originalUrl = normalizeUrl(body.data.originalUrl);
  if (!originalUrl) {
    res.status(400).json({ error: "Please enter a valid HTTP or HTTPS URL." });
    return;
  }

  try {
    const url = await createWithUniqueCode((code) =>
      prisma.url.create({ data: { shortCode: code, originalUrl } }));
    const configuredOrigin = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, "");
    const origin = configuredOrigin || `${req.protocol}://${req.get("host")}`;
    res.status(201).json(CreateUrlResponse.parse({
      shortUrl: `${origin}/${url.shortCode}`,
      shortCode: url.shortCode,
      originalUrl: url.originalUrl,
    }));
  } catch (error) {
    safeError(req, res, error);
  }
});

async function findUrl(req: Request, res: Response, redirect: boolean): Promise<void> {
  const params = GetUrlParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).send(redirect ? "Short URL not found." : { error: "Short URL not found." });
    return;
  }
  try {
    const url = await prisma.url.findUnique({ where: { shortCode: params.data.shortCode } });
    if (!url) {
      res.status(404).send(redirect ? "Short URL not found." : { error: "Short URL not found." });
      return;
    }
    if (redirect) {
      res.redirect(302, url.originalUrl);
    } else {
      res.json(GetUrlResponse.parse({ originalUrl: url.originalUrl }));
    }
  } catch (error) {
    safeError(req, res, error);
  }
}

router.get("/urls/:shortCode", async (req, res): Promise<void> => findUrl(req, res, false));
export const redirectRouter: IRouter = Router();
redirectRouter.get("/:shortCode", async (req, res): Promise<void> => findUrl(req, res, true));

export default router;