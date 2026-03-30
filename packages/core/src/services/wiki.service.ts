import { eq, and, desc, sql } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { wikiPages, wikiPageVersions } from "../db/schema.js";
import type {
  WikiPage,
  WikiPageVersion,
  CreateWikiPageInput,
  UpdateWikiPageInput,
} from "../types/index.js";
import { ActivityLogger } from "./activity-logger.js";

export class WikiService {
  private logger: ActivityLogger;

  constructor(private db: Database) {
    this.logger = new ActivityLogger(db);
  }

  async list(workspaceId: string, parentId?: string | null): Promise<WikiPage[]> {
    const conditions = [eq(wikiPages.workspaceId, workspaceId)];

    if (parentId !== undefined) {
      if (parentId === null) {
        conditions.push(sql`${wikiPages.parentId} IS NULL`);
      } else {
        conditions.push(eq(wikiPages.parentId, parentId));
      }
    }

    return this.db
      .select()
      .from(wikiPages)
      .where(and(...conditions))
      .orderBy(desc(wikiPages.updatedAt));
  }

  async getById(id: string): Promise<WikiPage | undefined> {
    const results = await this.db
      .select()
      .from(wikiPages)
      .where(eq(wikiPages.id, id))
      .limit(1);
    return results[0];
  }

  async getBySlug(
    workspaceId: string,
    slug: string,
  ): Promise<WikiPage | undefined> {
    const results = await this.db
      .select()
      .from(wikiPages)
      .where(
        and(eq(wikiPages.workspaceId, workspaceId), eq(wikiPages.slug, slug)),
      )
      .limit(1);
    return results[0];
  }

  async create(input: CreateWikiPageInput): Promise<WikiPage> {
    const [page] = await this.db
      .insert(wikiPages)
      .values({
        workspaceId: input.workspaceId,
        parentId: input.parentId ?? null,
        slug: input.slug,
        title: input.title,
        content: input.content ?? "",
        summary: input.summary ?? null,
        tags: input.tags ?? [],
        linkedEpics: input.linkedEpics ?? [],
        linkedIssues: input.linkedIssues ?? [],
        version: 1,
        metadata: input.metadata ?? {},
      })
      .returning();

    // Save initial version
    await this.db.insert(wikiPageVersions).values({
      wikiPageId: page.id,
      version: 1,
      content: page.content,
      changeSummary: "Initial version",
      changedBy: "system",
    });

    await this.logger.logCreate(input.workspaceId, "wiki_page", page.id);

    return page;
  }

  async update(id: string, input: UpdateWikiPageInput): Promise<WikiPage> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error(`Wiki page not found: ${id}`);
    }

    // Save the current version before updating
    if (input.content !== undefined && input.content !== existing.content) {
      await this.db.insert(wikiPageVersions).values({
        wikiPageId: id,
        version: existing.version,
        content: existing.content,
        changeSummary: input.changeSummary ?? null,
        changedBy: input.changedBy ?? null,
      });
    }

    const updateData: Record<string, unknown> = {};
    if (input.parentId !== undefined) updateData.parentId = input.parentId;
    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.content !== undefined) {
      updateData.content = input.content;
      updateData.version = existing.version + 1;
    }
    if (input.summary !== undefined) updateData.summary = input.summary;
    if (input.tags !== undefined) updateData.tags = input.tags;
    if (input.linkedEpics !== undefined)
      updateData.linkedEpics = input.linkedEpics;
    if (input.linkedIssues !== undefined)
      updateData.linkedIssues = input.linkedIssues;
    if (input.metadata !== undefined) updateData.metadata = input.metadata;
    updateData.updatedAt = new Date();

    const [updated] = await this.db
      .update(wikiPages)
      .set(updateData)
      .where(eq(wikiPages.id, id))
      .returning();

    await this.logger.logUpdate(
      existing.workspaceId,
      "wiki_page",
      id,
      updateData,
    );

    return updated;
  }

  async getHistory(id: string): Promise<WikiPageVersion[]> {
    return this.db
      .select()
      .from(wikiPageVersions)
      .where(eq(wikiPageVersions.wikiPageId, id))
      .orderBy(desc(wikiPageVersions.version));
  }

  async search(workspaceId: string, query: string): Promise<WikiPage[]> {
    const pattern = `%${query}%`;
    return this.db
      .select()
      .from(wikiPages)
      .where(
        and(
          eq(wikiPages.workspaceId, workspaceId),
          sql`(
            ${wikiPages.title} ILIKE ${pattern}
            OR ${wikiPages.content} ILIKE ${pattern}
            OR ${wikiPages.summary} ILIKE ${pattern}
          )`,
        ),
      )
      .orderBy(desc(wikiPages.updatedAt));
  }
}
