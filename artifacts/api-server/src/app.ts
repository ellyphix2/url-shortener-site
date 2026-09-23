import express from "express";
import { pinoHttp } from "pino-http";
import router from "./routes/index.js";
import { redirectRouter } from "./routes/urls.js";
import { logger } from "./lib/logger.js";

const app = express();
// Trust the single reverse-proxy hop in front of this server when reading client IPs.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(express.json({ limit: "8kb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(redirectRouter);

app.use((error: unknown, _req: unknown, response: unknown, _next: unknown) => {
  const res = response as {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  };

  if (error instanceof SyntaxError && "body" in error) {
    res.statusCode = 400;
    res.setHeader("content-type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ error: "Invalid JSON request body." }));
    return;
  }
  logger.error({ err: error }, "Unhandled request error");
  res.statusCode = 500;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Something went wrong. Please try again later." }));
});

export default app;
