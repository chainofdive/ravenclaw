import { eq, and, ilike, desc, sql } from "drizzle-orm";
import { type Database } from "../db/client.js";
import {
  ontologyConcepts,
  ontologyRelations,
  epics,
  issues,
  wikiPages,
} from "../db/schema.js";
import type {
  OntologyConcept,
  OntologyRelation,
  CreateOntologyRelationInput,
  ConceptFilters,
} from "../types/index.js";
import { ActivityLogger } from "./activity-logger.js";

export class OntologyService {
  private logger: ActivityLogger;

  constructor(private db: Database) {
    this.logger = new ActivityLogger(db);
  }

  async getConcepts(
    workspaceId: string,
    filters?: ConceptFilters,
  ): Promise<OntologyConcept[]> {
    const conditions = [eq(ontologyConcepts.workspaceId, workspaceId)];

    if (filters?.conceptType) {
      conditions.push(eq(ontologyConcepts.conceptType, filters.conceptType));
    }
    if (filters?.name) {
      conditions.push(ilike(ontologyConcepts.name, `%${filters.name}%`));
    }

    return this.db
      .select()
      .from(ontologyConcepts)
      .where(and(...conditions))
      .orderBy(desc(ontologyConcepts.frequency));
  }

  async getRelations(workspaceId: string): Promise<
    Array<
      OntologyRelation & {
        sourceConcept: { name: string; conceptType: string };
        targetConcept: { name: string; conceptType: string };
      }
    >
  > {
    const results = await this.db.query.ontologyRelations.findMany({
      where: eq(ontologyRelations.workspaceId, workspaceId),
      with: {
        sourceConcept: {
          columns: { name: true, conceptType: true },
        },
        targetConcept: {
          columns: { name: true, conceptType: true },
        },
      },
    });

    return results as Array<
      OntologyRelation & {
        sourceConcept: { name: string; conceptType: string };
        targetConcept: { name: string; conceptType: string };
      }
    >;
  }

  async extractConcepts(
    text: string,
    entityType: string,
    entityId: string,
    workspaceId: string,
  ): Promise<OntologyConcept[]> {
    const extracted: Array<{ name: string; type: "technology" | "domain" | "pattern" | "person" | "system" | "custom" }> = [];

    // Extract hashtag terms: #React, #TypeScript
    const hashtagRegex = /#(\w+)/g;
    let match: RegExpExecArray | null;
    while ((match = hashtagRegex.exec(text)) !== null) {
      extracted.push({ name: match[1], type: "technology" });
    }

    // Extract backtick terms: `React`, `drizzle-orm`
    const backtickRegex = /`([^`]+)`/g;
    while ((match = backtickRegex.exec(text)) !== null) {
      const term = match[1];
      // Skip terms that look like code snippets (have spaces or special chars)
      if (term.length <= 50 && !term.includes("\n")) {
        extracted.push({ name: term, type: "technology" });
      }
    }

    // Extract capitalized phrases (2+ words, likely proper nouns)
    const capitalizedRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
    while ((match = capitalizedRegex.exec(text)) !== null) {
      const term = match[1];
      // Simple heuristic: if it looks like a person name (2 words), mark as person
      const words = term.split(/\s+/);
      if (words.length === 2) {
        extracted.push({ name: term, type: "person" });
      } else {
        extracted.push({ name: term, type: "domain" });
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const unique = extracted.filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Upsert concepts
    const results: OntologyConcept[] = [];
    for (const item of unique) {
      const existing = await this.db
        .select()
        .from(ontologyConcepts)
        .where(
          and(
            eq(ontologyConcepts.workspaceId, workspaceId),
            sql`lower(${ontologyConcepts.name}) = lower(${item.name})`,
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Update frequency and add source ref
        const concept = existing[0];
        const sourceRefs = (concept.sourceRefs ?? []) as Array<{
          entityType: string;
          entityId: string;
        }>;
        const alreadyReferenced = sourceRefs.some(
          (r) => r.entityType === entityType && r.entityId === entityId,
        );

        if (!alreadyReferenced) {
          sourceRefs.push({ entityType, entityId });
        }

        const [updated] = await this.db
          .update(ontologyConcepts)
          .set({
            frequency: concept.frequency + 1,
            sourceRefs,
            updatedAt: new Date(),
          })
          .where(eq(ontologyConcepts.id, concept.id))
          .returning();

        results.push(updated);
      } else {
        const [created] = await this.db
          .insert(ontologyConcepts)
          .values({
            workspaceId,
            name: item.name,
            conceptType: item.type,
            sourceRefs: [{ entityType, entityId }],
            aliases: [],
            frequency: 1,
            metadata: {},
          })
          .returning();

        results.push(created);
      }
    }

    return results;
  }

  async rebuildForWorkspace(workspaceId: string): Promise<void> {
    // Delete existing concepts for this workspace
    await this.db
      .delete(ontologyRelations)
      .where(eq(ontologyRelations.workspaceId, workspaceId));
    await this.db
      .delete(ontologyConcepts)
      .where(eq(ontologyConcepts.workspaceId, workspaceId));

    // Re-extract from all epics
    const allEpics = await this.db
      .select()
      .from(epics)
      .where(eq(epics.workspaceId, workspaceId));

    for (const epic of allEpics) {
      const text = `${epic.title} ${epic.description}`;
      await this.extractConcepts(text, "epic", epic.id, workspaceId);
    }

    // Re-extract from all issues
    const allIssues = await this.db
      .select()
      .from(issues)
      .where(eq(issues.workspaceId, workspaceId));

    for (const issue of allIssues) {
      const text = `${issue.title} ${issue.description}`;
      await this.extractConcepts(text, "issue", issue.id, workspaceId);
    }

    // Re-extract from all wiki pages
    const allPages = await this.db
      .select()
      .from(wikiPages)
      .where(eq(wikiPages.workspaceId, workspaceId));

    for (const page of allPages) {
      const text = `${page.title} ${page.content}`;
      await this.extractConcepts(text, "wiki_page", page.id, workspaceId);
    }
  }

  async addRelation(
    input: CreateOntologyRelationInput,
  ): Promise<OntologyRelation> {
    const [relation] = await this.db
      .insert(ontologyRelations)
      .values({
        workspaceId: input.workspaceId,
        sourceConceptId: input.sourceConceptId,
        targetConceptId: input.targetConceptId,
        relationType: input.relationType,
        strength: input.strength ?? "0.5",
        evidence: input.evidence ?? [],
      })
      .returning();

    return relation;
  }
}
