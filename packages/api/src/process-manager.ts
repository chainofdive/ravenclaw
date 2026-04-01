/**
 * Process Manager — spawns and monitors agent (claude) processes.
 *
 * When a directive is dispatched to an agent, this manager:
 * 1. Spawns a `claude` process with the instruction as prompt
 * 2. Captures stdout/stderr into a log buffer per directive
 * 3. Detects completion/failure and updates directive status
 * 4. Provides SSE-compatible log streaming
 */

import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import type { AgentService } from "@ravenclaw/core";

export interface ProcessInfo {
  directiveId: string;
  agentId: string;
  process: ChildProcess;
  logs: string[];
  startedAt: Date;
  status: "running" | "completed" | "failed";
}

export class ProcessManager extends EventEmitter {
  private processes = new Map<string, ProcessInfo>();

  constructor(private agentService: AgentService) {
    super();
  }

  /**
   * Spawn an agent process to execute a directive.
   * Supports claude-code, gemini-cli, and codex.
   */
  async spawn(
    directiveId: string,
    agentId: string,
    instruction: string,
    config?: {
      agentType?: string;
      model?: string;
      cwd?: string;
      allowedTools?: string[];
    },
  ): Promise<ProcessInfo> {
    const agentType = config?.agentType ?? "claude-code";
    const { command, args } = this.buildCommand(agentType, instruction, config);

    const child = spawn(command, args, {
      cwd: config?.cwd ?? process.cwd(),
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const info: ProcessInfo = {
      directiveId,
      agentId,
      process: child,
      logs: [],
      startedAt: new Date(),
      status: "running",
    };

    this.processes.set(directiveId, info);

    // Update agent status
    await this.agentService.updateAgentStatus(agentId, "running", {
      processId: child.pid,
      currentDirectiveId: directiveId,
    });

    // Capture stdout
    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      info.logs.push(text);
      this.emit("log", { directiveId, agentId, type: "stdout", text });
    });

    // Capture stderr
    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      info.logs.push(`[stderr] ${text}`);
      this.emit("log", { directiveId, agentId, type: "stderr", text });
    });

    // Handle exit
    child.on("close", async (code) => {
      info.status = code === 0 ? "completed" : "failed";
      this.emit("exit", {
        directiveId,
        agentId,
        code,
        status: info.status,
      });

      // Update agent to idle
      try {
        await this.agentService.updateAgentStatus(agentId, "idle", {
          processId: undefined,
          currentDirectiveId: null,
        });
      } catch {
        // Agent may have been deleted
      }

      // Clean up after a delay to allow log reading
      setTimeout(() => {
        this.processes.delete(directiveId);
      }, 300_000); // Keep logs for 5 minutes
    });

    child.on("error", async (err) => {
      info.status = "failed";
      info.logs.push(`[error] ${err.message}`);
      this.emit("log", {
        directiveId,
        agentId,
        type: "error",
        text: err.message,
      });
      this.emit("exit", {
        directiveId,
        agentId,
        code: -1,
        status: "failed",
      });

      try {
        await this.agentService.updateAgentStatus(agentId, "error", {
          processId: undefined,
          currentDirectiveId: null,
        });
      } catch {
        // ignore
      }
    });

    return info;
  }

  /**
   * Kill a running process.
   */
  kill(directiveId: string): boolean {
    const info = this.processes.get(directiveId);
    if (!info || info.status !== "running") return false;
    info.process.kill("SIGTERM");
    return true;
  }

  /**
   * Get logs for a directive.
   */
  getLogs(directiveId: string): string[] {
    return this.processes.get(directiveId)?.logs ?? [];
  }

  /**
   * Get info for a running process.
   */
  getProcess(directiveId: string): ProcessInfo | undefined {
    return this.processes.get(directiveId);
  }

  /**
   * List all tracked processes.
   */
  listProcesses(): Array<{
    directiveId: string;
    agentId: string;
    status: string;
    pid: number | undefined;
    startedAt: Date;
    logLines: number;
  }> {
    return Array.from(this.processes.values()).map((p) => ({
      directiveId: p.directiveId,
      agentId: p.agentId,
      status: p.status,
      pid: p.process.pid,
      startedAt: p.startedAt,
      logLines: p.logs.length,
    }));
  }

  /**
   * Build the command and args for a given agent type.
   */
  private buildCommand(
    agentType: string,
    instruction: string,
    config?: { model?: string; allowedTools?: string[]; permissionMode?: string },
  ): { command: string; args: string[] } {
    switch (agentType) {
      case "gemini-cli": {
        // Gemini CLI: gemini -p "prompt"
        const args = ["-p", instruction];
        if (config?.model) args.push("--model", config.model);
        return { command: "gemini", args };
      }

      case "codex": {
        // OpenAI Codex CLI: codex -q "prompt"
        const args = ["-q", instruction];
        if (config?.model) args.push("--model", config.model);
        return { command: "codex", args };
      }

      case "claude-code":
      default: {
        // Claude Code: claude -p "prompt" --output-format text --verbose
        const args = [
          "-p",
          instruction,
          "--output-format",
          "text",
          "--verbose",
        ];
        if (config?.model) args.push("--model", config.model);
        if (config?.allowedTools && config.allowedTools.length > 0) {
          args.push("--allowedTools", config.allowedTools.join(","));
        }
        // Default to auto permission for headless execution
        const permMode = config?.permissionMode ?? "auto";
        if (permMode !== "default") {
          args.push("--permission-mode", permMode);
        }
        return { command: "claude", args };
      }
    }
  }
}
