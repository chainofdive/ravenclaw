import { eq, and, desc } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { humanInputRequests } from "../db/schema.js";
import type {
  HumanInputRequest,
  CreateHumanInputRequestInput,
  AnswerHumanInputInput,
} from "../types/index.js";

export class HumanInputService {
  constructor(private db: Database) {}

  async request(input: CreateHumanInputRequestInput): Promise<HumanInputRequest> {
    const [req] = await this.db
      .insert(humanInputRequests)
      .values({
        workspaceId: input.workspaceId,
        projectId: input.projectId ?? null,
        epicId: input.epicId ?? null,
        issueId: input.issueId ?? null,
        sessionId: input.sessionId ?? null,
        agentName: input.agentName ?? "unknown",
        urgency: input.urgency ?? "blocking",
        question: input.question,
        context: input.context ?? null,
        options: input.options ?? null,
      })
      .returning();
    return req;
  }

  async answer(id: string, input: AnswerHumanInputInput): Promise<HumanInputRequest> {
    const [updated] = await this.db
      .update(humanInputRequests)
      .set({
        status: "answered",
        answer: input.answer,
        answeredBy: input.answeredBy ?? "user",
        answeredAt: new Date(),
      })
      .where(eq(humanInputRequests.id, id))
      .returning();
    return updated;
  }

  async cancel(id: string): Promise<HumanInputRequest> {
    const [updated] = await this.db
      .update(humanInputRequests)
      .set({ status: "cancelled" })
      .where(eq(humanInputRequests.id, id))
      .returning();
    return updated;
  }

  async getById(id: string): Promise<HumanInputRequest | undefined> {
    const [req] = await this.db
      .select()
      .from(humanInputRequests)
      .where(eq(humanInputRequests.id, id))
      .limit(1);
    return req;
  }

  async listWaiting(workspaceId: string): Promise<HumanInputRequest[]> {
    return this.db
      .select()
      .from(humanInputRequests)
      .where(
        and(
          eq(humanInputRequests.workspaceId, workspaceId),
          eq(humanInputRequests.status, "waiting"),
        ),
      )
      .orderBy(desc(humanInputRequests.createdAt));
  }

  async listByProject(projectId: string, limit = 50): Promise<HumanInputRequest[]> {
    return this.db
      .select()
      .from(humanInputRequests)
      .where(eq(humanInputRequests.projectId, projectId))
      .orderBy(desc(humanInputRequests.createdAt))
      .limit(limit);
  }

  async checkAnswer(id: string): Promise<{ status: string; answer?: string }> {
    const req = await this.getById(id);
    if (!req) return { status: "not_found" };
    if (req.status === "answered") {
      return { status: "answered", answer: req.answer! };
    }
    return { status: req.status };
  }
}
