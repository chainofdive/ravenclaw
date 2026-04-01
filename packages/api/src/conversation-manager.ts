/**
 * Conversation Manager — manages persistent chat sessions per project.
 *
 * Uses `claude -p "..." --resume <session-id>` for conversation continuity.
 * Each project has one active conversation. Messages are sent sequentially,
 * and the claude session ID is tracked for resumption.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { AgentService } from "@ravenclaw/core";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface ActiveConversation {
  projectId: string;
  agentId: string;
  agentType: string;
  claudeSessionId?: string;
  messages: ConversationMessage[];
  currentProcess: ChildProcess | null;
  isProcessing: boolean;
  cwd: string;
}

export class ConversationManager extends EventEmitter {
  private conversations = new Map<string, ActiveConversation>();

  constructor(private agentService: AgentService) {
    super();
  }

  /**
   * Start or get a conversation for a project.
   */
  getOrCreate(
    projectId: string,
    agentId: string,
    agentType: string,
    cwd: string,
  ): ActiveConversation {
    let conv = this.conversations.get(projectId);
    if (!conv) {
      conv = {
        projectId,
        agentId,
        agentType,
        messages: [],
        currentProcess: null,
        isProcessing: false,
        cwd,
      };
      this.conversations.set(projectId, conv);
    }
    // Update agent if changed
    conv.agentId = agentId;
    conv.agentType = agentType;
    conv.cwd = cwd;
    return conv;
  }

  /**
   * Send a message in a conversation. Returns the response as it streams.
   */
  async sendMessage(projectId: string, message: string): Promise<void> {
    const conv = this.conversations.get(projectId);
    if (!conv) throw new Error(`No conversation for project ${projectId}`);
    if (conv.isProcessing)
      throw new Error("Agent is still processing previous message");

    conv.isProcessing = true;
    conv.messages.push({
      role: "user",
      content: message,
      timestamp: new Date(),
    });

    this.emit("message", { projectId, role: "user", content: message });

    try {
      const { command, args } = this.buildCommand(conv, message);

      const child = spawn(command, args, {
        cwd: conv.cwd,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      conv.currentProcess = child;
      let fullResponse = "";
      let sessionId: string | undefined;

      // Parse stream-json output for claude-code
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

              // Capture session ID
              if (event.session_id && !sessionId) {
                sessionId = event.session_id;
                conv.claudeSessionId = sessionId;
              }

              // Stream assistant text
              if (event.type === "assistant" && event.message?.content) {
                for (const block of event.message.content) {
                  if (block.type === "text") {
                    fullResponse += block.text;
                    this.emit("stream", {
                      projectId,
                      text: block.text,
                      done: false,
                    });
                  }
                }
              }

              // Result event
              if (event.type === "result") {
                if (event.session_id) {
                  conv.claudeSessionId = event.session_id;
                }
              }
            } catch {
              // Not JSON — treat as raw text
              fullResponse += line + "\n";
              this.emit("stream", {
                projectId,
                text: line + "\n",
                done: false,
              });
            }
          }
        });
      } else {
        // gemini-cli, codex — plain text output
        child.stdout?.on("data", (data: Buffer) => {
          const text = data.toString();
          fullResponse += text;
          this.emit("stream", { projectId, text, done: false });
        });
      }

      child.stderr?.on("data", (data: Buffer) => {
        const text = data.toString();
        this.emit("stream", {
          projectId,
          text: `[stderr] ${text}`,
          done: false,
        });
      });

      await new Promise<void>((resolve) => {
        child.on("close", () => {
          conv.isProcessing = false;
          conv.currentProcess = null;

          if (fullResponse.trim()) {
            conv.messages.push({
              role: "assistant",
              content: fullResponse,
              timestamp: new Date(),
            });
          }

          this.emit("stream", { projectId, text: "", done: true });
          this.emit("response", {
            projectId,
            content: fullResponse,
            sessionId: conv.claudeSessionId,
          });
          resolve();
        });

        child.on("error", (err) => {
          conv.isProcessing = false;
          conv.currentProcess = null;
          this.emit("stream", {
            projectId,
            text: `[error] ${err.message}`,
            done: true,
          });
          resolve();
        });
      });
    } catch (err: any) {
      conv.isProcessing = false;
      this.emit("stream", {
        projectId,
        text: `[error] ${err.message}`,
        done: true,
      });
    }
  }

  /**
   * Get conversation history.
   */
  getHistory(projectId: string): ConversationMessage[] {
    return this.conversations.get(projectId)?.messages ?? [];
  }

  /**
   * Check if a conversation is active.
   */
  isProcessing(projectId: string): boolean {
    return this.conversations.get(projectId)?.isProcessing ?? false;
  }

  /**
   * Clear conversation history (start fresh).
   */
  clear(projectId: string): void {
    const conv = this.conversations.get(projectId);
    if (conv) {
      conv.messages = [];
      conv.claudeSessionId = undefined;
    }
  }

  /**
   * Stop the current process.
   */
  stop(projectId: string): boolean {
    const conv = this.conversations.get(projectId);
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
        const args = [
          "-p",
          message,
          "--output-format",
          "stream-json",
          "--verbose",
        ];

        // Resume previous session for conversation continuity
        if (conv.claudeSessionId) {
          args.push("--resume", conv.claudeSessionId);
        }

        return { command: "claude", args };
      }
    }
  }
}
