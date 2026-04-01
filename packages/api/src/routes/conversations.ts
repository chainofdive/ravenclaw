import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../app.js";
import type { ConversationManager } from "../conversation-manager.js";
import { badRequest, notFound } from "../middleware/error.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveProjectId(c: any, idOrKey: string, workspaceId: string): Promise<{ id: string; directory: string | null }> {
  const svc = c.get("projectService");
  const p = UUID_RE.test(idOrKey) ? await svc.getById(idOrKey) : await svc.getByKey(workspaceId, idOrKey);
  if (!p) badRequest(`Project not found: ${idOrKey}`);
  return { id: p!.id, directory: p!.directory };
}

export function createConversationRoutes(conversationManager: ConversationManager) {
  const conv = new Hono<AppEnv>();

  // GET /:projectId/list — list conversations for a project
  conv.get("/:projectId/list", async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id: projectId } = await resolveProjectId(c, c.req.param("projectId"), workspaceId);
    const list = await conversationManager.listConversations(projectId);
    return c.json({ data: list });
  });

  // POST /:projectId/new — create a new conversation
  conv.post("/:projectId/new", async (c) => {
    const workspaceId = c.get("workspaceId");
    const agentService = c.get("agentService");
    const { id: projectId, directory } = await resolveProjectId(c, c.req.param("projectId"), workspaceId);
    const body = await c.req.json().catch(() => ({}));

    let agentType = "claude-code";
    if (body.agentId) {
      const agent = await agentService.getAgent(body.agentId);
      if (agent) agentType = agent.agentType;
    }

    const conversation = await conversationManager.createConversation(
      workspaceId, projectId, agentType, directory ?? process.cwd(), body.title,
    );
    return c.json({ data: { id: conversation.id, agentType } }, 201);
  });

  // POST /:projectId/message — send message (auto-creates conversation if needed)
  conv.post("/:projectId/message", async (c) => {
    const workspaceId = c.get("workspaceId");
    const agentService = c.get("agentService");
    const { id: projectId, directory } = await resolveProjectId(c, c.req.param("projectId"), workspaceId);
    const body = await c.req.json();

    if (!body.message?.trim()) badRequest("message is required");

    let agentType = "claude-code";
    if (body.agentId) {
      const agent = await agentService.getAgent(body.agentId);
      if (agent) agentType = agent.agentType;
    }

    // Get or create conversation
    const conversation = await conversationManager.getOrCreateConversation(
      workspaceId, projectId, agentType, directory ?? process.cwd(), body.conversationId,
      body.permissionMode ?? "auto",
    );

    if (conversationManager.isProcessing(conversation.id)) {
      badRequest("Agent is still processing. Wait or stop first.");
    }

    conversationManager.sendMessage(conversation.id, body.message.trim()).catch(() => {});

    return c.json({ data: { sent: true, conversationId: conversation.id } });
  });

  // GET /:projectId/stream — SSE stream (listens to active conversation)
  conv.get("/:projectId/stream", async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id: projectId } = await resolveProjectId(c, c.req.param("projectId"), workspaceId);

    return streamSSE(c, async (stream) => {
      const streamHandler = (event: { projectId: string; conversationId: string; text: string; done: boolean }) => {
        if (event.projectId === projectId) {
          stream.writeSSE({
            data: JSON.stringify({ text: event.text, done: event.done, conversationId: event.conversationId }),
            event: "stream",
          }).catch(() => {});
        }
      };

      const statusHandler = (event: { projectId: string; activity: string }) => {
        if (event.projectId === projectId) {
          stream.writeSSE({
            data: JSON.stringify({ activity: event.activity }),
            event: "status",
          }).catch(() => {});
        }
      };

      conversationManager.on("stream", streamHandler);
      conversationManager.on("status", statusHandler);
      const keepAlive = setInterval(() => { stream.writeSSE({ data: "", event: "ping" }).catch(() => {}); }, 15000);

      stream.onAbort(() => {
        conversationManager.off("stream", streamHandler);
        conversationManager.off("status", statusHandler);
        clearInterval(keepAlive);
      });

      await new Promise<void>(() => {});
    });
  });

  // GET /:projectId/history?conversation_id=... — get messages
  conv.get("/:projectId/history", async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id: projectId, directory } = await resolveProjectId(c, c.req.param("projectId"), workspaceId);
    const conversationId = c.req.query("conversation_id");

    const conversation = await conversationManager.getOrCreateConversation(
      workspaceId, projectId, "claude-code", directory ?? process.cwd(), conversationId ?? undefined,
    );

    const messages = await conversationManager.getMessages(conversation.id);

    return c.json({
      data: {
        conversationId: conversation.id,
        messages,
        isProcessing: conversationManager.isProcessing(conversation.id),
      },
    });
  });

  // POST /:projectId/stop
  conv.post("/:projectId/stop", async (c) => {
    const workspaceId = c.get("workspaceId");
    const { id: projectId, directory } = await resolveProjectId(c, c.req.param("projectId"), workspaceId);

    // Find active conversation
    const conversation = await conversationManager.getOrCreateConversation(
      workspaceId, projectId, "claude-code", directory ?? process.cwd(),
    );
    const stopped = conversationManager.stop(conversation.id);
    return c.json({ data: { stopped } });
  });

  return conv;
}
