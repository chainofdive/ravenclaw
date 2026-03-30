import { eq, and, or } from "drizzle-orm";
import { type Database } from "../db/client.js";
import { dependencies } from "../db/schema.js";
import type {
  Dependency,
  CreateDependencyInput,
  EntityType,
} from "../types/index.js";

export class DependencyService {
  constructor(private db: Database) {}

  async create(input: CreateDependencyInput): Promise<Dependency> {
    // Check for circular dependency before creating
    const hasCycle = await this.detectCycle(
      { type: input.sourceType, id: input.sourceId },
      { type: input.targetType, id: input.targetId },
    );

    if (hasCycle) {
      throw new Error(
        "Cannot create dependency: circular dependency detected",
      );
    }

    const [dep] = await this.db
      .insert(dependencies)
      .values({
        workspaceId: input.workspaceId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        dependencyType: input.dependencyType,
      })
      .returning();

    return dep;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(dependencies).where(eq(dependencies.id, id));
  }

  async getForEntity(
    entityType: EntityType,
    entityId: string,
  ): Promise<Dependency[]> {
    return this.db
      .select()
      .from(dependencies)
      .where(
        or(
          and(
            eq(dependencies.sourceType, entityType),
            eq(dependencies.sourceId, entityId),
          ),
          and(
            eq(dependencies.targetType, entityType),
            eq(dependencies.targetId, entityId),
          ),
        ),
      );
  }

  async getBlockers(
    entityType: EntityType,
    entityId: string,
  ): Promise<Dependency[]> {
    // What blocks this entity: things that have "blocks" pointing at this entity
    // OR this entity "depends_on" something
    return this.db
      .select()
      .from(dependencies)
      .where(
        or(
          and(
            eq(dependencies.targetType, entityType),
            eq(dependencies.targetId, entityId),
            eq(dependencies.dependencyType, "blocks"),
          ),
          and(
            eq(dependencies.sourceType, entityType),
            eq(dependencies.sourceId, entityId),
            eq(dependencies.dependencyType, "depends_on"),
          ),
        ),
      );
  }

  async getBlocked(
    entityType: EntityType,
    entityId: string,
  ): Promise<Dependency[]> {
    // What this entity blocks: this entity "blocks" something
    // OR something "depends_on" this entity
    return this.db
      .select()
      .from(dependencies)
      .where(
        or(
          and(
            eq(dependencies.sourceType, entityType),
            eq(dependencies.sourceId, entityId),
            eq(dependencies.dependencyType, "blocks"),
          ),
          and(
            eq(dependencies.targetType, entityType),
            eq(dependencies.targetId, entityId),
            eq(dependencies.dependencyType, "depends_on"),
          ),
        ),
      );
  }

  async detectCycle(
    source: { type: EntityType; id: string },
    target: { type: EntityType; id: string },
  ): Promise<boolean> {
    // BFS from target to see if we can reach source, which would create a cycle
    const visited = new Set<string>();
    const queue: Array<{ type: EntityType; id: string }> = [target];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = `${current.type}:${current.id}`;

      if (current.type === source.type && current.id === source.id) {
        return true;
      }

      if (visited.has(key)) {
        continue;
      }
      visited.add(key);

      // Get all entities that this current entity depends on (outgoing blocking edges)
      const outgoing = await this.db
        .select()
        .from(dependencies)
        .where(
          or(
            and(
              eq(dependencies.sourceType, current.type),
              eq(dependencies.sourceId, current.id),
              eq(dependencies.dependencyType, "blocks"),
            ),
            and(
              eq(dependencies.targetType, current.type),
              eq(dependencies.targetId, current.id),
              eq(dependencies.dependencyType, "depends_on"),
            ),
          ),
        );

      for (const dep of outgoing) {
        if (dep.dependencyType === "blocks") {
          queue.push({ type: dep.targetType, id: dep.targetId });
        } else {
          queue.push({ type: dep.sourceType, id: dep.sourceId });
        }
      }
    }

    return false;
  }
}
