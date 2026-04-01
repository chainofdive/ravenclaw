import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../app.js";
import type { ConversationManager } from "../conversation-manager.js";
import { badRequest } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createConversationRoutes(conversationManager: ConversationManager) {
  const conv = new Hono<AppEnv>();

  // POST /api/v1/conversations/:projectId/start — initialize conversation
  conv.post("/:projectId/start", async (c) => {
    const projectService = c.get("projectService");
    const agentService = c.get("agentService");
    const workspaceId = c.get("workspaceId");
    const projectIdParam = c.req.param("projectId");
    const body = await c.req.json().catch(() => ({}));

    // Resolve project
    const project = UUID_RE.test(projectIdParam)
      ? await projectService.getById(projectIdParam)
      : await projectService.getByKey(workspaceId, projectIdParam);
    if (!project) badRequest(`Project not found: ${projectIdParam}`);

    // Find agent
    const agentId = body.agentId ?? body.agent_id;
    let agent;
    if (agentId) {
      agent = await agentService.getAgent(agentId);
    } else {
      agent = await agentService.getIdleAgent(workspaceId);
    }
    if (!agent) badRequest("No available agent");

    const conversation = conversationManager.getOrCreate(
      project!.id,
      agent!.id,
      agent!.agentType,
      project!.directory ?? process.cwd(),
    );

    return c.json({
      data: {
        projectId: project!.id,
        agentId: agent!.id,
        agentType: agent!.agentType,
        messageCount: conversation.messages.length,
        isProcessing: conversation.isProcessing,
      },
    });
  });

  // POST /api/v1/conversations/:projectId/message — send a message
  conv.post("/:projectId/message", async (c) => {
    const projectService = c.get("projectService");
    const workspaceId = c.get("workspaceId");
    const projectIdParam = c.req.param("projectId");
    const body = await c.req.json();

    if (!body.message?.trim()) badRequest("message is required");

    const project = UUID_RE.test(projectIdParam)
      ? await projectService.getById(projectIdParam)
      : await projectService.getByKey(workspaceId, projectIdParam);
    if (!project) badRequest(`Project not found: ${projectIdParam}`);

    const projectId = project!.id;

    // Auto-start conversation if not exists
    if (!conversationManager.getHistory(projectId).length && !conversationManager.isProcessing(projectId)) {
      const agentService = c.get("agentService");
      const agentId = body.agentId ?? body.agent_id;
      let agent;
      if (agentId) {
        agent = await agentService.getAgent(agentId);
      } else {
        agent = await agentService.getIdleAgent(workspaceId);
      }
      if (!agent) badRequest("No available agent");

      conversationManager.getOrCreate(
        projectId,
        agent!.id,
        agent!.agentType,
        project!.directory ?? process.cwd(),
      );
    }

    if (conversationManager.isProcessing(projectId)) {
      badRequest("Agent is still processing previous message. Wait or stop it first.");
    }

    // Fire and forget — client will listen via SSE
    conversationManager.sendMessage(projectId, body.message.trim()).catch(() => {});

    return c.json({ data: { sent: true, projectId } });
  });

  // GET /api/v1/conversations/:projectId/stream — SSE stream
  conv.get("/:projectId/stream", async (c) => {
    const projectService = c.get("projectService");
    const workspaceId = c.get("workspaceId");
    const projectIdParam = c.req.param("projectId");

    const project = UUID_RE.test(projectIdParam)
      ? await projectService.getById(projectIdParam)
      : await projectService.getByKey(workspaceId, projectIdParam);

    const projectId = project?.id ?? projectIdParam;

    return streamSSE(c, async (stream) => {
      const handler = (event: { projectId: string; text: string; done: boolean }) => {
        if (event.projectId === projectId) {
          stream.writeSSE({
            data: JSON.stringify({ text: event.text, done: event.done }),
            event: "stream",
          }).catch(() => {});
        }
      };

      conversationManager.on("stream", handler);

      const keepAlive = setInterval(() => {
        stream.writeSSE({ data: "", event: "ping" }).catch(() => {});
      }, 15000);

      stream.onAbort(() => {
        conversationManager.off("stream", handler);
        clearInterval(keepAlive);
      });

      // Keep alive until client disconnects
      await new Promise<void>(() => {});
    });
  });

  // GET /api/v1/conversations/:projectId/history — get conversation history
  conv.get("/:projectId/history", async (c) => {
    const projectService = c.get("projectService");
    const workspaceId = c.get("workspaceId");
    const projectIdParam = c.req.param("projectId");

    const project = UUID_RE.test(projectIdParam)
      ? await projectService.getById(projectIdParam)
      : await projectService.getByKey(workspaceId, projectIdParam);

    const projectId = project?.id ?? projectIdParam;
    const history = conversationManager.getHistory(projectId);

    return c.json({
      data: {
        messages: history,
        isProcessing: conversationManager.isProcessing(projectId),
      },
    });
  });

  // POST /api/v1/conversations/:projectId/stop — stop current response
  conv.post("/:projectId/stop", async (c) => {
    const projectIdParam = c.req.param("projectId");
    const stopped = conversationManager.stop(projectIdParam);
    return c.json({ data: { stopped } });
  });

  // POST /api/v1/conversations/:projectId/clear — clear history
  conv.post("/:projectId/clear", async (c) => {
    const projectIdParam = c.req.param("projectId");
    conversationManager.clear(projectIdParam);
    return c.json({ data: { cleared: true } });
  });

  return conv;
}
