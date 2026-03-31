import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../app.js";
import type { ProcessManager } from "../process-manager.js";

/**
 * Create SSE routes. Requires ProcessManager instance.
 */
export function createSseRoutes(processManager: ProcessManager) {
  const sse = new Hono<AppEnv>();

  // GET /api/v1/sse/logs/:directiveId — stream logs for a directive
  sse.get("/logs/:directiveId", (c) => {
    const directiveId = c.req.param("directiveId");

    return streamSSE(c, async (stream) => {
      // Send existing logs first
      const existingLogs = processManager.getLogs(directiveId);
      for (const line of existingLogs) {
        await stream.writeSSE({ data: line, event: "log" });
      }

      // Then stream new logs
      const handler = (event: {
        directiveId: string;
        type: string;
        text: string;
      }) => {
        if (event.directiveId === directiveId) {
          stream
            .writeSSE({ data: event.text, event: "log" })
            .catch(() => {});
        }
      };

      const exitHandler = (event: {
        directiveId: string;
        status: string;
        code: number;
      }) => {
        if (event.directiveId === directiveId) {
          stream
            .writeSSE({
              data: JSON.stringify({
                status: event.status,
                code: event.code,
              }),
              event: "exit",
            })
            .catch(() => {});
        }
      };

      processManager.on("log", handler);
      processManager.on("exit", exitHandler);

      // Keep alive
      const keepAlive = setInterval(() => {
        stream.writeSSE({ data: "", event: "ping" }).catch(() => {});
      }, 15000);

      // Clean up when client disconnects
      stream.onAbort(() => {
        processManager.off("log", handler);
        processManager.off("exit", exitHandler);
        clearInterval(keepAlive);
      });

      // Wait until process exits or client disconnects
      await new Promise<void>((resolve) => {
        const checkExit = (event: { directiveId: string }) => {
          if (event.directiveId === directiveId) {
            processManager.off("exit", checkExit);
            // Give time for final logs
            setTimeout(resolve, 1000);
          }
        };
        processManager.on("exit", checkExit);

        // Also resolve if process already finished
        const info = processManager.getProcess(directiveId);
        if (!info || info.status !== "running") {
          setTimeout(resolve, 1000);
        }
      });
    });
  });

  // GET /api/v1/sse/processes — list active processes
  sse.get("/processes", (c) => {
    const list = processManager.listProcesses();
    return c.json({ data: list });
  });

  return sse;
}
