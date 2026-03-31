import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { RavenclawApiClient } from "../client.js";

export function registerHumanInputTools(
  server: McpServer,
  client: RavenclawApiClient,
): void {
  // ── request_human_input ─────────────────────────────────────────────
  server.tool(
    "request_human_input",
    "Ask the user a question and wait for their answer via the web UI. Use this when you need a human decision, clarification, or approval before proceeding. The user will be notified in the Ravenclaw web dashboard. After calling this, poll check_human_input with the returned request ID.",
    {
      question: z
        .string()
        .describe("The question to ask the user — be specific and provide context"),
      project_id: z
        .string()
        .optional()
        .describe("Related project ID or key"),
      epic_id: z
        .string()
        .optional()
        .describe("Related epic ID or key"),
      issue_id: z
        .string()
        .optional()
        .describe("Related issue ID or key"),
      context: z
        .string()
        .optional()
        .describe("Additional context to help the user understand the situation"),
      options: z
        .array(z.string())
        .optional()
        .describe("Suggested options for the user (e.g. ['Option A', 'Option B'])"),
      urgency: z
        .enum(["blocking", "normal", "low"])
        .default("blocking")
        .describe("blocking = agent is paused waiting, normal = can continue other work, low = informational"),
      agent_name: z
        .string()
        .optional()
        .describe("Your agent name"),
      session_id: z
        .string()
        .optional()
        .describe("Your session ID"),
    },
    async ({ question, project_id, epic_id, issue_id, context, options, urgency, agent_name, session_id }) => {
      const req = (await client.requestHumanInput({
        question,
        projectId: project_id,
        epicId: epic_id,
        issueId: issue_id,
        context,
        options,
        urgency,
        agentName: agent_name,
        sessionId: session_id,
      })) as Record<string, unknown>;

      return {
        content: [
          {
            type: "text",
            text: [
              `Human input requested. Request ID: ${req.id}`,
              "",
              `Question: ${question}`,
              urgency === "blocking"
                ? "Status: BLOCKING — waiting for user response."
                : `Status: ${urgency} — you may continue other work.`,
              "",
              `To check for an answer, call: check_human_input(request_id: "${req.id}")`,
              "",
              "The user will see this in the Ravenclaw web dashboard.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  // ── check_human_input ───────────────────────────────────────────────
  server.tool(
    "check_human_input",
    "Check if the user has answered a human input request. Poll this after calling request_human_input.",
    {
      request_id: z.string().describe("The request ID returned by request_human_input"),
    },
    async ({ request_id }) => {
      const result = (await client.checkHumanInput(request_id)) as Record<
        string,
        unknown
      >;

      if (result.status === "answered") {
        return {
          content: [
            {
              type: "text",
              text: `User answered: ${result.answer}`,
            },
          ],
        };
      }

      if (result.status === "cancelled") {
        return {
          content: [
            { type: "text", text: "Request was cancelled by the user." },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: "Still waiting for user input. Try again later.",
          },
        ],
      };
    },
  );

  // ── list_pending_inputs ─────────────────────────────────────────────
  server.tool(
    "list_pending_inputs",
    "List all pending human input requests (waiting for user response).",
    {},
    async () => {
      const requests = (await client.listWaitingInputs()) as Array<
        Record<string, unknown>
      >;

      if (requests.length === 0) {
        return {
          content: [
            { type: "text", text: "No pending input requests." },
          ],
        };
      }

      const lines = requests.map((r) => {
        const age = Math.round(
          (Date.now() - new Date(String(r.createdAt)).getTime()) / 60000,
        );
        return `- **${r.id}** [${r.urgency}] ${age}m ago by ${r.agentName}\n  Q: ${String(r.question).substring(0, 200)}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `## Pending Input Requests (${requests.length})\n\n${lines.join("\n\n")}`,
          },
        ],
      };
    },
  );
}
