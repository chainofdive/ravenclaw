import { eq, and, desc, sql } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { epics, issues, wikiPages } from "../db/schema.js";
import type { EntityType, SearchFilters } from "../types/index.js";

export interface SearchResult {
  entityType: EntityType;
  entityId: string;
  key?: string;
  title: string;
  snippet: string;
  score: number;
  updatedAt: Date;
}

export class SearchService {
  constructor(private db: Database) {}

  async search(
    workspaceId: string,
    query: string,
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;
    const entityTypes = filters?.entityTypes ?? [
      "epic",
      "issue",
      "wiki_page",
    ];

    const results: SearchResult[] = [];
    const pattern = `%${query}%`;

    if (entityTypes.includes("epic")) {
      const epicResults = await this.db
        .select()
        .from(epics)
        .where(
          and(
            eq(epics.workspaceId, workspaceId),
            sql`(
              ${epics.title} ILIKE ${pattern}
              OR ${epics.description} ILIKE ${pattern}
              OR ${epics.key} ILIKE ${pattern}
            )`,
          ),
        )
        .orderBy(desc(epics.updatedAt));

      for (const epic of epicResults) {
        results.push({
          entityType: "epic",
          entityId: epic.id,
          key: epic.key,
          title: epic.title,
          snippet: this.extractSnippet(
            `${epic.title} ${epic.description}`,
            query,
          ),
          score: this.calculateScore(
            `${epic.title} ${epic.description}`,
            query,
          ),
          updatedAt: epic.updatedAt,
        });
      }
    }

    if (entityTypes.includes("issue")) {
      const issueResults = await this.db
        .select()
        .from(issues)
        .where(
          and(
            eq(issues.workspaceId, workspaceId),
            sql`(
              ${issues.title} ILIKE ${pattern}
              OR ${issues.description} ILIKE ${pattern}
              OR ${issues.key} ILIKE ${pattern}
            )`,
          ),
        )
        .orderBy(desc(issues.updatedAt));

      for (const issue of issueResults) {
        results.push({
          entityType: "issue",
          entityId: issue.id,
          key: issue.key,
          title: issue.title,
          snippet: this.extractSnippet(
            `${issue.title} ${issue.description}`,
            query,
          ),
          score: this.calculateScore(
            `${issue.title} ${issue.description}`,
            query,
          ),
          updatedAt: issue.updatedAt,
        });
      }
    }

    if (entityTypes.includes("wiki_page")) {
      const pageResults = await this.db
        .select()
        .from(wikiPages)
        .where(
          and(
            eq(wikiPages.workspaceId, workspaceId),
            sql`(
              ${wikiPages.title} ILIKE ${pattern}
              OR ${wikiPages.content} ILIKE ${pattern}
              OR ${wikiPages.slug} ILIKE ${pattern}
            )`,
          ),
        )
        .orderBy(desc(wikiPages.updatedAt));

      for (const page of pageResults) {
        results.push({
          entityType: "wiki_page",
          entityId: page.id,
          title: page.title,
          snippet: this.extractSnippet(
            `${page.title} ${page.content}`,
            query,
          ),
          score: this.calculateScore(
            `${page.title} ${page.content}`,
            query,
          ),
          updatedAt: page.updatedAt,
        });
      }
    }

    // Sort by score descending, then by updatedAt
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.updatedAt.getTime() - a.updatedAt.getTime();
    });

    return results.slice(offset, offset + limit);
  }

  private extractSnippet(text: string, query: string): string {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);

    if (idx === -1) {
      return text.slice(0, 200);
    }

    const start = Math.max(0, idx - 80);
    const end = Math.min(text.length, idx + query.length + 80);
    let snippet = text.slice(start, end);

    if (start > 0) snippet = "..." + snippet;
    if (end < text.length) snippet = snippet + "...";

    return snippet;
  }

  private calculateScore(text: string, query: string): number {
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();

    let score = 0;

    // Exact match in text
    const idx = lowerText.indexOf(lowerQuery);
    if (idx !== -1) {
      score += 10;
      // Bonus for appearing early (likely in title)
      if (idx < 100) score += 5;
    }

    // Count occurrences
    let pos = 0;
    let occurrences = 0;
    for (
      let found = lowerText.indexOf(lowerQuery, pos);
      found !== -1;
      found = lowerText.indexOf(lowerQuery, pos)
    ) {
      occurrences++;
      pos = found + 1;
    }
    score += Math.min(occurrences * 2, 10);

    // Word boundary match bonus
    const words = lowerQuery.split(/\s+/);
    for (const word of words) {
      if (word && lowerText.includes(word)) {
        score += 1;
      }
    }

    return score;
  }
}
