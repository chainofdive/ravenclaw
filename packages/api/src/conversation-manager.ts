/**
 * Conversation Manager — manages persistent chat sessions per project.
 *
 * Uses `claude -p "..." --resume <session-id>` for conversation continuity.
 * Persists conversations and messages to DB for durability.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { eq, and, desc } from "drizzle-orm";
import type { AgentService } from "@ravenclaw/core";
import { conversations, conversationMessages } from "@ravenclaw/core";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ActiveConversation {
  id: string; // DB conversation id
  projectId: string;
  agentType: string;
  claudeSessionId?: string;
  currentProcess: ChildProcess | null;
  isProcessing: boolean;
  cwd: string;
}

export class ConversationManager extends EventEmitter {
  private active = new Map<string, ActiveConversation>();

  constructor(
    private agentService: AgentService,
    private db: any,
  ) {
    super();
  }

  /**
   * List conversations for a project.
   */
  async listConversations(
    projectId: string,
  ): Promise<Array<{ id: string; title: string | null; agentType: string; isActive: number; createdAt: Date; updatedAt: Date; externalSessionId: string | null }>> {
    return this.db
      .select()
      .from(conversations)
      .where(eq(conversations.projectId, projectId))
      .orderBy(desc(conversations.updatedAt));
  }

  /**
   * Get or create a conversation for a project.
   */
  async getOrCreateConversation(
    workspaceId: string,
    projectId: string,
    agentType: string,
    cwd: string,
    conversationId?: string,
  ): Promise<ActiveConversation> {
    // If specific conversation requested, load it
    if (conversationId) {
      const existing = this.active.get(conversationId);
      if (existing) return existing;

      const [conv] = await this.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);

      if (conv) {
        const active: ActiveConversation = {
          id: conv.id,
          projectId,
          agentType: conv.agentType,
          claudeSessionId: conv.externalSessionId ?? undefined,
          currentProcess: null,
          isProcessing: false,
          cwd,
        };
        this.active.set(conv.id, active);
        return active;
      }
    }

    // Check if there's an active conversation for this project in memory
    for (const [, conv] of this.active) {
      if (conv.projectId === projectId) return conv;
    }

    // Check DB for most recent active conversation
    const [existing] = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.projectId, projectId),
          eq(conversations.isActive, 1),
        ),
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing) {
      const active: ActiveConversation = {
        id: existing.id,
        projectId,
        agentType: existing.agentType,
        claudeSessionId: existing.externalSessionId ?? undefined,
        currentProcess: null,
        isProcessing: false,
        cwd,
      };
      this.active.set(existing.id, active);
      return active;
    }

    // Create new conversation
    const title = `Conversation ${new Date().toLocaleDateString()}`;
    const [newConv] = await this.db
      .insert(conversations)
      .values({
        workspaceId,
        projectId,
        title,
        agentType,
      })
      .returning();

    const active: ActiveConversation = {
      id: newConv.id,
      projectId,
      agentType,
      currentProcess: null,
      isProcessing: false,
      cwd,
    };
    this.active.set(newConv.id, active);
    return active;
  }

  /**
   * Create a new conversation (explicit).
   */
  async createConversation(
    workspaceId: string,
    projectId: string,
    agentType: string,
    cwd: string,
    title?: string,
  ): Promise<ActiveConversation> {
    // Deactivate previous
    await this.db
      .update(conversations)
      .set({ isActive: 0 })
      .where(
        and(
          eq(conversations.projectId, projectId),
          eq(conversations.isActive, 1),
        ),
      );

    const [newConv] = await this.db
      .insert(conversations)
      .values({
        workspaceId,
        projectId,
        title: title ?? `Conversation ${new Date().toLocaleDateString()}`,
        agentType,
      })
      .returning();

    // Remove old active from memory
    for (const [key, conv] of this.active) {
      if (conv.projectId === projectId) {
        this.active.delete(key);
      }
    }

    const active: ActiveConversation = {
      id: newConv.id,
      projectId,
      agentType,
      currentProcess: null,
      isProcessing: false,
      cwd,
    };
    this.active.set(newConv.id, active);
    return active;
  }

  /**
   * Get messages for a conversation.
   */
  async getMessages(
    conversationId: string,
  ): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
    return this.db
      .select({
        role: conversationMessages.role,
        content: conversationMessages.content,
        createdAt: conversationMessages.createdAt,
      })
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.createdAt);
  }

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId: string, message: string): Promise<void> {
    const conv = this.active.get(conversationId);
    if (!conv) throw new Error(`No active conversation: ${conversationId}`);
    if (conv.isProcessing)
      throw new Error("Agent is still processing previous message");

    conv.isProcessing = true;

    // Persist user message
    await this.db.insert(conversationMessages).values({
      conversationId,
      role: "user",
      content: message,
    });

    this.emit("message", { conversationId, projectId: conv.projectId, role: "user", content: message });

    try {
      const { command, args } = this.buildCommand(conv, message);

      const child = spawn(command, args, {
        cwd: conv.cwd,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      conv.currentProcess = child;
      let fullResponse = "";
      let emittedLength = 0;
      let doneEmitted = false;

      if (conv.agentType === "claude-code") {
        let buffer = "";
        child.stdout?.on("data", (data: Buffer) => {
          buffer += data.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event = JSON.parse(line);

              if (event.session_id && !conv.claudeSessionId) {
                conv.claudeSessionId = event.session_id;
              }

              if (event.type === "result") {
                if (event.session_id) conv.claudeSessionId = event.session_id;
                const resultText = event.result ?? "";
                if (resultText && resultText.length > emittedLength) {
                  const delta = resultText.substring(emittedLength);
                  fullResponse = resultText;
                  emittedLength = resultText.length;
                  this.emit("stream", { conversationId, projectId: conv.projectId, text: delta, done: false });
                }
                continue;
              }

              if (event.type === "assistant" && event.message?.content) {
                let currentText = "";
                let hasToolUse = false;
                let toolName = "";
                for (const block of event.message.content) {
                  if (block.type === "text") currentText += block.text;
                  if (block.type === "tool_use") {
                    hasToolUse = true;
                    toolName = block.name ?? "tool";
                  }
                }
                if (currentText.length > emittedLength) {
                  const delta = currentText.substring(emittedLength);
                  fullResponse = currentText;
                  emittedLength = currentText.length;
                  this.emit("stream", { conversationId, projectId: conv.projectId, text: delta, done: false });
                }
                // Emit tool activity status
                if (hasToolUse) {
                  this.emit("status", { conversationId, projectId: conv.projectId, activity: `Running: ${toolName}` });
                }
              }
            } catch {
              fullResponse += line + "\n";
              emittedLength = fullResponse.length;
              this.emit("stream", { conversationId, projectId: conv.projectId, text: line + "\n", done: false });
            }
          }
        });
      } else {
        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          fullResponse += text;
          this.emit("stream", { conversationId, projectId: conv.projectId, text, done: false });
        });
      }

      child.stderr?.on("data", (data: Buffer) => {
        this.emit("stream", { conversationId, projectId: conv.projectId, text: `[stderr] ${data.toString()}`, done: false });
      });

      await new Promise<void>((resolve) => {
        const finish = async () => {
          if (doneEmitted) return;
          doneEmitted = true;
          conv.isProcessing = false;
          conv.currentProcess = null;

          // Persist assistant message
          if (fullResponse.trim()) {
            await this.db.insert(conversationMessages).values({
              conversationId,
              role: "assistant",
              content: fullResponse,
            });
          }

          // Persist claude session ID
          if (conv.claudeSessionId) {
            await this.db
              .update(conversations)
              .set({ externalSessionId: conv.claudeSessionId, updatedAt: new Date() })
              .where(eq(conversations.id, conversationId));
          }

          this.emit("stream", { conversationId, projectId: conv.projectId, text: "", done: true });
          resolve();
        };

        child.on("close", finish);
        child.on("error", (err) => {
          fullResponse += `\n[error] ${err.message}`;
          this.emit("stream", { conversationId, projectId: conv.projectId, text: `[error] ${err.message}`, done: false });
          finish();
        });
      });
    } catch (err: any) {
      conv.isProcessing = false;
      this.emit("stream", { conversationId, projectId: conv.projectId, text: `[error] ${err.message}`, done: true });
    }
  }

  isProcessing(conversationId: string): boolean {
    return this.active.get(conversationId)?.isProcessing ?? false;
  }

  stop(conversationId: string): boolean {
    const conv = this.active.get(conversationId);
    if (conv?.currentProcess) {
      conv.currentProcess.kill("SIGTERM");
      conv.isProcessing = false;
      return true;
    }
    return false;
  }

  private buildCommand(
    conv: ActiveConversation,
    message: string,
  ): { command: string; args: string[] } {
    switch (conv.agentType) {
      case "gemini-cli":
        return { command: "gemini", args: ["-p", message] };
      case "codex":
        return { command: "codex", args: ["-q", message] };
      case "claude-code":
      default: {
        const args = ["-p", message, "--output-format", "stream-json", "--verbose"];
        if (conv.claudeSessionId) {
          args.push("--resume", conv.claudeSessionId);
        }
        return { command: "claude", args };
      }
    }
  }
}
