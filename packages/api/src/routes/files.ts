import { Hono } from "hono";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import type { AppEnv } from "../app.js";
import { badRequest, notFound, forbidden } from "../middleware/error.js";

const files = new Hono<AppEnv>();

const MIME_TYPES: Record<string, string> = {
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".ts": "text/typescript; charset=utf-8",
  ".tsx": "text/typescript; charset=utf-8",
  ".yaml": "text/yaml; charset=utf-8",
  ".yml": "text/yaml; charset=utf-8",
  ".toml": "text/toml; charset=utf-8",
  ".log": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// GET /api/v1/files?path=...&project_id=RC-P1
// path can be absolute or relative to the project directory
files.get("/", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");

  const filePath = c.req.query("path");
  const projectId = c.req.query("project_id");

  if (!filePath) badRequest("Query parameter 'path' is required");

  // Resolve the path — try absolute first, then relative to project dir
  let absolutePath = resolve(filePath!);
  let allowed = false;

  // If project_id is given, try resolving relative to project directory
  if (projectId) {
    const project = /^[0-9a-f-]{36}$/i.test(projectId)
      ? await projectService.getById(projectId)
      : await projectService.getByKey(workspaceId, projectId);

    if (project?.directory) {
      const projectDir = resolve(project.directory);

      // If the path doesn't start with the project dir, treat as relative
      if (!absolutePath.startsWith(projectDir)) {
        // Strip leading slash for relative resolution
        const relativePart = filePath!.startsWith("/") ? filePath!.substring(1) : filePath!;
        absolutePath = resolve(projectDir, relativePart);
      }

      if (absolutePath.startsWith(projectDir)) {
        allowed = true;
      }
    }
  }

  // If still not allowed, check all projects (for absolute paths)
  if (!allowed) {
    const projects = await projectService.list(workspaceId);
    for (const p of projects) {
      if (p.directory) {
        const dir = resolve(p.directory);
        // Try as-is
        if (absolutePath.startsWith(dir)) {
          allowed = true;
          break;
        }
        // Try relative resolution
        const relativePart = filePath!.startsWith("/") ? filePath!.substring(1) : filePath!;
        const candidate = resolve(dir, relativePart);
        if (candidate.startsWith(dir)) {
          absolutePath = candidate;
          allowed = true;
          break;
        }
      }
    }
  }

  if (!allowed) {
    forbidden("File is not within any registered project directory");
  }

  // Check file exists and size
  try {
    const s = await stat(absolutePath);
    if (!s.isFile()) notFound("Not a file");
    if (s.size > MAX_FILE_SIZE) badRequest("File too large (max 10MB)");
  } catch {
    notFound(`File not found: ${absolutePath}`);
  }

  const ext = extname(absolutePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const data = await readFile(absolutePath);

  return new Response(data, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      "Cache-Control": "no-cache",
    },
  });
});

// GET /api/v1/files/info?path=...&project_id=... — metadata only
files.get("/info", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");

  const filePath = c.req.query("path");
  const projectId = c.req.query("project_id");
  if (!filePath) badRequest("Query parameter 'path' is required");

  let absolutePath = resolve(filePath!);

  // Resolve relative to project or any project
  const projects = await projectService.list(workspaceId);
  let allowed = false;

  // Try project_id first
  if (projectId) {
    const project = /^[0-9a-f-]{36}$/i.test(projectId)
      ? await projectService.getById(projectId)
      : await projectService.getByKey(workspaceId, projectId);
    if (project?.directory) {
      const dir = resolve(project.directory);
      if (!absolutePath.startsWith(dir)) {
        const rel = filePath!.startsWith("/") ? filePath!.substring(1) : filePath!;
        absolutePath = resolve(dir, rel);
      }
      if (absolutePath.startsWith(dir)) allowed = true;
    }
  }

  if (!allowed) {
    for (const p of projects) {
      if (p.directory) {
        const dir = resolve(p.directory);
        if (absolutePath.startsWith(dir)) { allowed = true; break; }
        const rel = filePath!.startsWith("/") ? filePath!.substring(1) : filePath!;
        const candidate = resolve(dir, rel);
        if (candidate.startsWith(dir)) { absolutePath = candidate; allowed = true; break; }
      }
    }
  }
  if (!allowed) forbidden("File is not within any project directory");

  try {
    const s = await stat(absolutePath);
    const ext = extname(absolutePath).toLowerCase();
    return c.json({
      data: {
        path: absolutePath,
        size: s.size,
        ext,
        mime: MIME_TYPES[ext] || "application/octet-stream",
        modified: s.mtime.toISOString(),
        isPreviewable: [".md", ".txt", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".pdf", ".json", ".html"].includes(ext),
      },
    });
  } catch {
    notFound(`File not found: ${absolutePath}`);
  }
});

export default files;
