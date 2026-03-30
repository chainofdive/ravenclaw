import { Hono } from "hono";
import type { AppEnv } from "../app.js";

const health = new Hono<AppEnv>();

health.get("/", (c) => {
  return c.json({
    data: {
      status: "ok",
      version: "0.1.0",
      timestamp: new Date().toISOString(),
    },
  });
});

export default health;
