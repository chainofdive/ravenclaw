import { eq, and, desc } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { comments } from "../db/schema.js";
import type { Comment, EntityType } from "../types/index.js";

export class CommentService {
  constructor(private db: Database) {}

  async list(entityType: EntityType, entityId: string): Promise<Comment[]> {
    return this.db
      .select()
      .from(comments)
      .where(
        and(
          eq(comments.entityType, entityType),
          eq(comments.entityId, entityId),
        ),
      )
      .orderBy(desc(comments.createdAt));
  }

  async create(input: {
    workspaceId: string;
    entityType: EntityType;
    entityId: string;
    content: string;
    author?: string;
  }): Promise<Comment> {
    const [comment] = await this.db
      .insert(comments)
      .values({
        workspaceId: input.workspaceId,
        entityType: input.entityType,
        entityId: input.entityId,
        content: input.content,
        author: input.author ?? "user",
      })
      .returning();
    return comment;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(comments).where(eq(comments.id, id));
  }

  async getForWorkspace(
    workspaceId: string,
    limit: number = 20,
  ): Promise<Comment[]> {
    return this.db
      .select()
      .from(comments)
      .where(eq(comments.workspaceId, workspaceId))
      .orderBy(desc(comments.createdAt))
      .limit(limit);
  }
}
