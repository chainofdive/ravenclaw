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

// GET /api/v1/files?path=/absolute/path&project_id=RC-P1
files.get("/", async (c) => {
  const projectService = c.get("projectService");
  const workspaceId = c.get("workspaceId");

  const filePath = c.req.query("path");
  const projectId = c.req.query("project_id");

  if (!filePath) badRequest("Query parameter 'path' is required");

  const absolutePath = resolve(filePath!);

  // Security: verify file is within a project directory
  let allowed = false;
  if (projectId) {
    const project = /^[0-9a-f-]{36}$/i.test(projectId)
      ? await projectService.getById(projectId)
      : await projectService.getByKey(workspaceId, projectId);
    if (project?.directory && absolutePath.startsWith(resolve(project.directory))) {
      allowed = true;
    }
  }

  // If no project_id or not matched, check all projects
  if (!allowed) {
    const projects = await projectService.list(workspaceId);
    for (const p of projects) {
      if (p.directory && absolutePath.startsWith(resolve(p.directory))) {
        allowed = true;
        break;
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
  if (!filePath) badRequest("Query parameter 'path' is required");

  const absolutePath = resolve(filePath!);

  // Verify access
  const projects = await projectService.list(workspaceId);
  let allowed = false;
  for (const p of projects) {
    if (p.directory && absolutePath.startsWith(resolve(p.directory))) {
      allowed = true;
      break;
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
