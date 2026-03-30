import type { Context } from "hono";

export async function requestLogger(c: Context, next: () => Promise<void>) {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;

  console.log(`[REQ] ${method} ${path}`);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  const level = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO";
  console.log(`[${level}] ${method} ${path} ${status} ${duration}ms`);
}
