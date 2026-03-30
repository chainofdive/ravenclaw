import { type Database } from "../db/client.js";
import { activityLog } from "../db/schema.js";
import type { EntityType, ActivityAction } from "../types/index.js";

export interface LogActivityParams {
  workspaceId: string;
  entityType: EntityType;
  entityId: string;
  action: ActivityAction;
  actor: string;
  changes?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export class ActivityLogger {
  constructor(
    private db: Database,
    private defaultActor: string = "system",
  ) {}

  async log(params: LogActivityParams): Promise<void> {
    await this.db.insert(activityLog).values({
      workspaceId: params.workspaceId,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      actor: params.actor || this.defaultActor,
      changes: params.changes ?? {},
      context: params.context ?? {},
    });
  }

  async logCreate(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    actor?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    await this.log({
      workspaceId,
      entityType,
      entityId,
      action: "created",
      actor: actor ?? this.defaultActor,
      context,
    });
  }

  async logUpdate(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    changes: Record<string, unknown>,
    actor?: string,
  ): Promise<void> {
    await this.log({
      workspaceId,
      entityType,
      entityId,
      action: "updated",
      actor: actor ?? this.defaultActor,
      changes,
    });
  }

  async logStatusChange(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    oldStatus: string,
    newStatus: string,
    actor?: string,
  ): Promise<void> {
    await this.log({
      workspaceId,
      entityType,
      entityId,
      action: "status_changed",
      actor: actor ?? this.defaultActor,
      changes: { from: oldStatus, to: newStatus },
    });
  }

  async logDelete(
    workspaceId: string,
    entityType: EntityType,
    entityId: string,
    actor?: string,
  ): Promise<void> {
    await this.log({
      workspaceId,
      entityType,
      entityId,
      action: "deleted",
      actor: actor ?? this.defaultActor,
    });
  }
}
